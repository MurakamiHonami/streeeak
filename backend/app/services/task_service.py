import datetime as dt
import json
import logging
import re
import uuid
from collections.abc import Sequence

import httpx
from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.goal import Goal
from app.models.task import TaskType
from app.models.user import User
from app.schemas.task import (
    BreakdownResponse,
    BreakdownTask,
    DraftTask,
    RevisionChatMessage,
    RevisionChatResponse,
    TaskRevisionProposal,
)

logger = logging.getLogger(__name__)


def _week_start(target: dt.date) -> dt.date:
    return target - dt.timedelta(days=target.weekday())


def _fallback_breakdown(goal: Goal, months: int, weeks_per_month: int, days_per_week: int) -> BreakdownResponse:
    monthly: list[BreakdownTask] = []
    weekly: list[BreakdownTask] = []
    daily: list[BreakdownTask] = []

    today = dt.date.today()
    this_week_start = _week_start(today)
    current_week = today.isocalendar().week

    for m in range(months):
        month_value = ((today.month - 1 + m) % 12) + 1
        monthly.append(
            BreakdownTask(
                type=TaskType.monthly,
                title=f"{goal.title} - 月間マイルストーン {m + 1}",
                month=month_value,
            )
        )

    for w in range(weeks_per_month):
        week_no = current_week + w
        weekly.append(
            BreakdownTask(
                type=TaskType.weekly,
                title=f"{goal.title} - 週次タスク {w + 1}",
                month=today.month,
                week_number=week_no,
            )
        )

    for d in range(days_per_week):
        daily.append(
            BreakdownTask(
                type=TaskType.daily,
                title=f"{goal.title} - デイリー行動 {d + 1}",
                month=today.month,
                week_number=current_week,
                date=this_week_start + dt.timedelta(days=d),
            )
        )

    return BreakdownResponse(source="fallback", monthly=monthly, weekly=weekly, daily=daily)


def _parse_titles(raw: object, fallback_prefix: str, max_items: int) -> list[str]:
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
        return [f"{fallback_prefix} {i + 1}" for i in range(max_items)]
    titles = [str(item).strip() for item in raw if str(item).strip()]
    if not titles:
        return [f"{fallback_prefix} {i + 1}" for i in range(max_items)]
    return titles[:max_items]


def _fallback_daily_details(title: str) -> list[str]:
    return [
        f"{title} の準備を5分で行う",
        f"{title} を集中して実行する",
        f"{title} の結果を記録して振り返る",
    ]


def _request_gemini_daily_details(daily_titles: list[str]) -> list[list[str]]:
    prompt = (
        "次の日次タスクごとに、実行可能な詳細TODOを3件ずつ作ってください。"
        "JSONのみ返答。形式は"
        '{"details":[["todo1","todo2","todo3"], ...]}。\n'
        f"日次タスク: {json.dumps(daily_titles, ensure_ascii=False)}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.6,
            "response_mime_type": "application/json",
        },
    }
    model_candidates = [
        settings.GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
    ]
    model_candidates = list(dict.fromkeys(model_candidates))
    base_versions = ["v1beta", "v1"]

    body: dict | None = None
    for version in base_versions:
        for model in model_candidates:
            url = (
                f"https://generativelanguage.googleapis.com/{version}/models/"
                f"{model}:generateContent?key={settings.GEMINI_API_KEY}"
            )
            response = httpx.post(url, json=payload, timeout=90.0)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            body = response.json()
            break
        if body is not None:
            break
    if body is None:
        raise ValueError("No available Gemini model/endpoint was found (404).")

    text = (
        body.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "{}")
    )
    cleaned = text.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned)
    cleaned = re.sub(r"```$", "", cleaned).strip()
    parsed = json.loads(cleaned)
    raw_details = parsed.get("details")
    if not isinstance(raw_details, list):
        raise ValueError("Gemini daily details format invalid")

    result: list[list[str]] = []
    for idx, item in enumerate(raw_details):
        if not isinstance(item, list):
            result.append(_fallback_daily_details(daily_titles[idx]))
            continue
        todos = [str(x).strip() for x in item if str(x).strip()]
        result.append((todos[:5] if todos else _fallback_daily_details(daily_titles[idx])))
    return result


def _request_gemini_breakdown(
    goal_title: str,
    months: int,
    weeks_per_month: int,
    days_per_week: int,
    deadline: dt.date | None = None,
    current_situation: str | None = None,
):
    deadline_text = deadline.isoformat() if deadline else "未設定"
    current_text = current_situation.strip() if current_situation else "未入力"
    prompt = (
        "あなたは目標分解のプロです。以下をJSONのみで返してください。\n"
        "ルール:\n"
        f"- monthly: 直近{months}ヶ月の目標配列（文字列）\n"
        f"- weekly: 直近1ヶ月の週次目標配列（最大{weeks_per_month}件、文字列）\n"
        f"- daily: 直近1週間の日次TODO配列（最大{days_per_week}件、文字列）\n"
        "- ユーザーの現状・期限・目標文脈を必ず反映\n"
        "- まずmonthlyを作り、その直近1ヶ月を元にweekly、直近1週間を元にdailyを作成\n"
        "- 目標が数値化できる場合（点数、秒、回数、距離、体重、件数など）は、monthly/weeklyに中間数値目標を必ず入れる\n"
        "- 数値は現状から最終目標に向けて単調に進むようにする（増やす指標は増加、減らす指標は減少）\n"
        "- 中間値は現実的で達成可能な幅にする。最後のmonthly/weeklyは最終目標値に一致させる\n"
        "- ユーザーが数値を明示していなくても、目標文から推定できるなら測定可能な数値目標を提案する\n"
        "- 各タイトルは具体的に、可能なら数値・単位（点、秒、回、km、kg、問など）を含める\n"
        "- JSON以外の文章は不要\n"
        '形式: {"monthly":["..."],"weekly":["..."],"daily":["..."]}\n'
        "例1: TOEICで現状600点、1ヶ月後700点 -> 1週目620点, 2週目640点, 3週目670点, 4週目700点\n"
        "例2: 50m走で現状7.0秒、2ヶ月後6.5秒 -> 1ヶ月目6.7秒, 2ヶ月目6.5秒\n"
        f"今は「{current_text}」の状態で、期限「{deadline_text}」までに、"
        f"目標「{goal_title}」を達成したいです。"
        "そのためにこれからやるべき目標をmonthly単位で作成したのち、"
        "直近の1ヶ月のmonthly目標からその月のweekly分の目標を作成し、"
        "直近の1週間の目標から、その週でやるべきことを1日ずつのdailyタスクとして作成してください。"
    )

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.6,
            "response_mime_type": "application/json",
        },
    }
    model_candidates = [
        settings.GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
    ]
    model_candidates = list(dict.fromkeys(model_candidates))
    base_versions = ["v1beta", "v1"]

    last_error: Exception | None = None
    body: dict | None = None
    for version in base_versions:
        for model in model_candidates:
            url = (
                f"https://generativelanguage.googleapis.com/{version}/models/"
                f"{model}:generateContent?key={settings.GEMINI_API_KEY}"
            )
            response = httpx.post(url, json=payload, timeout=90.0)
            if response.status_code == 404:
                continue
            try:
                response.raise_for_status()
                body = response.json()
                break
            except Exception as e:
                last_error = e
                continue
        if body is not None:
            break

    if body is None:
        if last_error:
            raise last_error
        raise ValueError("No available Gemini model/endpoint was found (404).")
    text = (
        body.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "{}")
    )
    cleaned = text.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned)
    cleaned = re.sub(r"```$", "", cleaned).strip()
    if cleaned.startswith("{") and cleaned.endswith("}"):
        return json.loads(cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1:
        return json.loads(cleaned[start : end + 1])
    raise ValueError("Gemini response is not valid JSON")


def _call_gemini_json(prompt: str) -> dict:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.6,
            "response_mime_type": "application/json",
        },
    }
    model_candidates = [
        settings.GEMINI_MODEL,
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
    ]
    model_candidates = list(dict.fromkeys(model_candidates))
    base_versions = ["v1beta", "v1"]
    last_error: Exception | None = None

    for version in base_versions:
        for model in model_candidates:
            url = (
                f"https://generativelanguage.googleapis.com/{version}/models/"
                f"{model}:generateContent?key={settings.GEMINI_API_KEY}"
            )
            response = httpx.post(url, json=payload, timeout=90.0)
            if response.status_code == 404:
                continue
            try:
                response.raise_for_status()
            except Exception as e:
                last_error = e
                continue
            body = response.json()
            text = (
                body.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text", "{}")
            )
            cleaned = text.strip()
            cleaned = re.sub(r"^```json\s*", "", cleaned)
            cleaned = re.sub(r"```$", "", cleaned).strip()
            if cleaned.startswith("{") and cleaned.endswith("}"):
                return json.loads(cleaned)
            start = cleaned.find("{")
            end = cleaned.rfind("}")
            if start != -1 and end != -1:
                return json.loads(cleaned[start : end + 1])
            raise ValueError("Gemini response is not valid JSON")
    if last_error:
        raise last_error
    raise ValueError("No available Gemini model/endpoint was found (404).")


def parse_note_subtasks(note: str | None) -> list[str]:
    if not note:
        return []
    return [
        line.replace("- ", "", 1).strip()
        for line in note.splitlines()
        if line.replace("- ", "", 1).strip()
    ]


def compose_note_subtasks(subtasks: list[str]) -> str:
    return "\n".join([f"- {item.strip()}" for item in subtasks if item.strip()])


def generate_revision_suggestions(
    goal_title: str,
    message: str,
    draft_tasks: list[DraftTask],
    chat_history: list[RevisionChatMessage],
) -> RevisionChatResponse:
    if not draft_tasks:
        return RevisionChatResponse(
            source="fallback",
            assistant_message="編集中のタスクが見つかりません。",
            proposals=[],
        )

    if not settings.GEMINI_API_KEY:
        return RevisionChatResponse(
            source="fallback",
            assistant_message="Geminiキー未設定のため提案を作成できません。",
            proposals=[],
        )

    draft_payload = [
        {
            "task_id": task.task_id,
            "task_type": task.task_type.value,
            "title": task.title,
            "subtasks": task.subtasks,
        }
        for task in draft_tasks
    ]
    history_payload = [{"role": m.role, "content": m.content} for m in chat_history]

    prompt = (
        "あなたはタスク編集アシスタントです。以下のドラフトタスクに対して、"
        "ユーザー要望に沿う修正提案を作成してください。JSONのみで返してください。\n"
        "ルール:\n"
        "- proposalsは最大8件\n"
        "- target_type は monthly/weekly/daily/subtask のいずれか\n"
        "- subtask提案時は subtask_index を必ず指定\n"
        "- task提案時は before/after はタイトル文言\n"
        "- subtask提案時は before/after はサブタスク文言\n"
        '形式: {"assistant_message":"...","proposals":[{"target_task_id":1,"target_type":"daily","subtask_index":0,"before":"...","after":"...","reason":"..."}]}\n'
        f"長期目標: {goal_title}\n"
        f"会話履歴: {json.dumps(history_payload, ensure_ascii=False)}\n"
        f"ユーザーメッセージ: {message}\n"
        f"ドラフトタスク: {json.dumps(draft_payload, ensure_ascii=False)}"
    )

    try:
        parsed = _call_gemini_json(prompt)
    except Exception as e:
        logger.exception("Gemini revision failed: %s", e)
        return RevisionChatResponse(
            source="fallback",
            assistant_message="Gemini提案の生成に失敗しました。再度試してください。",
            proposals=[],
        )

    proposals_raw = parsed.get("proposals")
    assistant_message = str(parsed.get("assistant_message", "提案を作成しました。"))
    if not isinstance(proposals_raw, list):
        return RevisionChatResponse(source="fallback", assistant_message=assistant_message, proposals=[])

    valid_task_map = {task.task_id: task for task in draft_tasks}
    proposals: list[TaskRevisionProposal] = []
    for item in proposals_raw:
        if not isinstance(item, dict):
            continue
        task_id = item.get("target_task_id")
        target_type = str(item.get("target_type", ""))
        if task_id not in valid_task_map:
            continue
        if target_type not in {"monthly", "weekly", "daily", "subtask"}:
            continue
        subtask_index = item.get("subtask_index")
        if target_type == "subtask":
            if not isinstance(subtask_index, int):
                continue
            subtasks = valid_task_map[task_id].subtasks
            if subtask_index < 0 or subtask_index >= len(subtasks):
                continue
        else:
            subtask_index = None

        proposals.append(
            TaskRevisionProposal(
                proposal_id=str(uuid.uuid4()),
                target_task_id=task_id,
                target_type=target_type,
                subtask_index=subtask_index,
                before=str(item.get("before", "")).strip(),
                after=str(item.get("after", "")).strip(),
                reason=str(item.get("reason", "改善提案")).strip(),
            )
        )

    return RevisionChatResponse(
        source="gemini",
        assistant_message=assistant_message,
        proposals=proposals,
    )


def build_breakdown(
    db: Session,
    current_user: User,
    goal: Goal,
    months: int,
    weeks_per_month: int,
    days_per_week: int,
    yearly_milestones: int = 0,
    current_situation: str | None = None,
) -> BreakdownResponse:
    if not getattr(current_user, 'is_premium', False):
        today_breakdowns = db.query(Goal).filter(
            Goal.user_id == current_user.id,
            func.date(Goal.created_at) == dt.date.today()
        ).count()
        if today_breakdowns > 1:
            raise HTTPException(status_code=403, detail="FREE_LIMIT_REACHED")

    today = dt.date.today()
    this_week_start = _week_start(today)
    current_week = today.isocalendar().week
    current_month = today.month

    if settings.GEMINI_API_KEY:
        try:
            ai = _request_gemini_breakdown(
                goal.title,
                months,
                weeks_per_month,
                days_per_week,
                deadline=goal.deadline,
                current_situation=current_situation,
            )
        except Exception as e:
            logger.exception("Gemini breakdown failed: %s", e)
            return _fallback_breakdown(goal, months, weeks_per_month, days_per_week)
    else:
        return _fallback_breakdown(goal, months, weeks_per_month, days_per_week)

    monthly_titles = _parse_titles(ai.get("monthly"), "月間マイルストーン", months)
    weekly_titles = _parse_titles(ai.get("weekly"), "週次タスク", weeks_per_month)
    daily_titles = _parse_titles(ai.get("daily"), "デイリー行動", days_per_week)
    if settings.GEMINI_API_KEY:
        try:
            daily_details = _request_gemini_daily_details(daily_titles)
        except Exception as e:
            logger.exception("Gemini daily details failed: %s", e)
            daily_details = [_fallback_daily_details(title) for title in daily_titles]
    else:
        daily_details = [_fallback_daily_details(title) for title in daily_titles]

    monthly: list[BreakdownTask] = []
    weekly: list[BreakdownTask] = []
    daily: list[BreakdownTask] = []

    for year_idx in range(yearly_milestones):
        year_no = year_idx + 1
        months_in_this_year = max(0, min(12, months - (year_idx * 12)))
        monthly.append(
            BreakdownTask(
                type=TaskType.monthly,
                title=f"{year_no}年目の目標: {goal.title}（{months_in_this_year}ヶ月計画）",
                month=None,
            )
        )

    for idx, title in enumerate(monthly_titles):
        month_value = ((current_month - 1 + idx) % 12) + 1
        if yearly_milestones > 0:
            year_no = (idx // 12) + 1
            month_no = (idx % 12) + 1
            title = f"{year_no}年目・{month_no}ヶ月目: {title}"
        monthly.append(
            BreakdownTask(type=TaskType.monthly, title=title, month=month_value)
        )

    for idx, title in enumerate(weekly_titles):
        weekly.append(
            BreakdownTask(
                type=TaskType.weekly,
                title=title,
                month=current_month,
                week_number=current_week + idx,
            )
        )

    for idx, title in enumerate(daily_titles):
        detail_lines = daily_details[idx] if idx < len(daily_details) else _fallback_daily_details(title)
        note = "\n".join([f"- {line}" for line in detail_lines])
        daily.append(
            BreakdownTask(
                type=TaskType.daily,
                title=title,
                month=current_month,
                week_number=current_week,
                date=this_week_start + dt.timedelta(days=idx),
                note=note,
            )
        )

    return BreakdownResponse(source="gemini", monthly=monthly, weekly=weekly, daily=daily)