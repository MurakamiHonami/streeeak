import datetime as dt
import json
import logging
import math
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


def _add_months(base: dt.date, months: int) -> dt.date:
    year = base.year + (base.month - 1 + months) // 12
    month = ((base.month - 1 + months) % 12) + 1
    month_days = [31, 29 if (year % 400 == 0 or (year % 4 == 0 and year % 100 != 0)) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(base.day, month_days[month - 1])
    return dt.date(year, month, day)


def _ceil_months_between(start: dt.date, end: dt.date) -> int:
    base_months = (end.year - start.year) * 12 + (end.month - start.month)
    anchor = _add_months(start, base_months)
    if anchor < end:
        return base_months + 1
    return max(0, base_months)


def derive_breakdown_scope(deadline: dt.date) -> tuple[int, int, int, int]:
    """
    今日と期限から (months, weeks_per_month, days_per_week, yearly_milestones) を算出する。
    - 30日未満: monthly 0, weekly ceil(days/7), daily = 日数
    - 1ヶ月以上: monthly = 今日から期限までの月数, weekly 4, daily 7, 1年超なら yearly_milestones
    """
    today = dt.date.today()
    total_days = max(1, (deadline - today).days + 1)
    if total_days < 30:
        weeks = max(1, math.ceil(total_days / 7))
        return (0, weeks, total_days, 0)
    months = max(1, _ceil_months_between(today, deadline))
    yearly_milestones = math.ceil(months / 12) if months > 12 else 0
    return (months, 4, 7, yearly_milestones)


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
        day_date = today + dt.timedelta(days=d)
        daily.append(
            BreakdownTask(
                type=TaskType.daily,
                title=f"{goal.title} - デイリー行動 {d + 1}",
                month=day_date.month,
                week_number=day_date.isocalendar().week,
                date=day_date,
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


def _strip_period_prefix(text: str) -> str:
    """月次・週次の目標テキストから「今から○ヶ月後:」「○週目:」などの接頭辞を除去する。"""
    s = text.strip()
    # 今からNヶ月後: / 今からNか月後:
    s = re.sub(r"^今から\s*\d+\s*[ヶか]月後\s*[：:]\s*", "", s)
    # N週目: / 第N週目:
    s = re.sub(r"^(?:第?\s*\d+\s*週目\s*[：:]\s*)", "", s)
    # 1年目・Nヶ月目: （コード側で付与していたものも含む）
    s = re.sub(r"^\d+年目\s*[・\.]\s*\d+\s*[ヶか]月目\s*[：:]\s*", "", s)
    return s.strip()


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
        f"- monthly: 今月を1番目とした直近{months}ヶ月の目標配列（必ず{months}件）。1件目=今月、2件目=来月、…、N件目=Nヶ月後\n"
        f"- weekly: 直近1ヶ月の週次目標配列（最大{weeks_per_month}件、文字列）\n"
        f"- daily: 開始日（今日）から{days_per_week}日間の日次TODO配列（{days_per_week}件、文字列）\n"
        "- ユーザーの現状・期限・目標文脈を必ず反映\n"
        "- monthlyの1件目は必ず「今月」の目標を含める。まずmonthlyを今月から順に作り、その直近1ヶ月を元にweekly、開始日から7日間を元にdailyを作成\n"
        "- 目標が数値化できる場合（点数、秒、回数、距離、体重、件数など）は、monthly/weeklyに中間数値目標を必ず入れる\n"
        "- 数値は現状から最終目標に向けて単調に進むようにする（増やす指標は増加、減らす指標は減少）\n"
        "- 中間値は現実的で達成可能な幅にする。最後のmonthly/weeklyは最終目標値に一致させる\n"
        "- ユーザーが数値を明示していなくても、目標文から推定できるなら測定可能な数値目標を提案する\n"
        "- 各タイトルは具体的に、可能なら数値・単位（点、秒、回、km、kg、問など）を含める\n"
        "- monthlyの各要素には「今から○ヶ月後:」などの接頭辞をつけず、目標内容のみを書く\n"
        "- weeklyの各要素には「1週目:」「2週目:」などの接頭辞をつけず、目標内容のみを書く\n"
        "- JSON以外の文章は不要\n"
        '形式: {"monthly":["..."],"weekly":["..."],"daily":["..."]}\n'
        "例1: TOEIC 現状600点→700点のとき monthly: [\"620点\", \"640点\", \"670点\", \"700点\"], weekly: [\"620点\", \"640点\", \"670点\", \"700点\"] のように内容のみ\n"
        "例2: 50m走 7.0秒→6.5秒のとき monthly: [\"6.7秒\", \"6.5秒\"] のように内容のみ\n"
        f"今は「{current_text}」の状態で、期限「{deadline_text}」までに、"
        f"目標「{goal_title}」を達成したいです。"
        "そのためにこれからやるべき目標をmonthly単位で作成したのち、"
        "直近の1ヶ月のmonthly目標からその月のweekly分の目標を作成し、"
        "開始日（今日）から7日間、1日ずつのdailyタスクとして作成してください。"
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

    today_ref = dt.date.today()
    today_iso = today_ref.isoformat()

    draft_payload = []
    for task in draft_tasks:
        item = {
            "task_id": task.task_id,
            "task_type": task.task_type.value,
            "title": task.title,
            "subtasks": task.subtasks,
        }
        if getattr(task, "date", None) is not None:
            item["date"] = task.date.isoformat() if hasattr(task.date, "isoformat") else str(task.date)
        if getattr(task, "month", None) is not None:
            item["month"] = task.month
        if getattr(task, "week_number", None) is not None:
            item["week_number"] = task.week_number
        draft_payload.append(item)

    history_payload = [{"role": m.role, "content": m.content} for m in chat_history]

    prompt = (
        "あなたはタスク編集アシスタントです。ユーザーが入力したテキストに基づき、"
        "**最終目標（長期目標）・月次(monthly)・週次(weekly)・日次(daily)タスクのうち、修正が必要なもの**を提案してください。"
        "JSONのみで返してください。\n\n"
        "【入力テキストの解釈】\n"
        "- ユーザーのメッセージは「何をどう直すか」の指示です。その指示に該当するタスクに対して、必ず修正提案を返すこと。\n"
        "- 例: 「週次タスクをもっと具体化して」→ 全ての weekly タスクを具体化した提案を返す。\n"
        "- 例: 「月次の目標を数値で」→ 全ての monthly タスクを数値目標にした提案を返す。\n"
        "- 例: 「全体的に具体化」「目標に合わせて」→ 最終目標(new_goal_title)や月次・週次・日次のうち必要なものを一貫して修正する提案を返す。\n"
        "- **提案は0件にしないこと**。ユーザーが変更を求めている限り、該当するタスクに対して少なくとも1件以上提案すること。\n\n"
        "【修正対象の範囲】\n"
        "- ユーザーが「今日のタスク」「今日だけ」「本日のタスク」など今日に言及した場合: "
        "date が「今日の日付」と一致する daily タスクのみ対象。\n"
        "- ユーザーが「週次だけ」「週次のタスクを」と言った場合: task_type が weekly のタスクのみ対象。\n"
        "- ユーザーが「月次だけ」「月次の目標を」と言った場合: task_type が monthly のタスクのみ対象。\n"
        "- ユーザーが「最終目標に合わせて」「目標に合わせてタスクを修正」と言った場合: "
        "長期目標に全タスクが整合するよう、月次・週次・日次を一貫して修正。直近1ヶ月目から最終月まで全て対象。\n"
        "- **上記以外（範囲が指定されていない）場合**: ユーザーメッセージの意図に沿い、最終目標・月次・週次・日次のうち**必要なレベルすべて**に提案する。\n\n"
        "【階層の一貫性（カスケード）】週次・月次・年次の修正時は、上位を修正したら下位も整合させる:\n"
        "- 年次・1年後・長期目標の変更（例: 「1年後の達成目標を上げる」「年間目標を上方修正」）: "
        "直近12ヶ月の月次(monthly)タスクを全て長期目標に合わせて修正する。12ヶ月目以降の月次タスクがある場合も同様に修正する。"
        "さらに、修正した各月に属する週次(weekly)タスク（同じ month のタスク）もその月の目標に合わせて修正する。"
        "同様に、修正した各週に属する日次(daily)タスク（同じ week_number のタスク）もその週の目標に合わせて修正する。\n"
        "- 月次(monthly)の目標が修正された場合: その月に属する週次(weekly)タスク（month がその月のタスク）を、修正後の月次目標に合わせて提案する。"
        "さらに、その週に属する日次(daily)タスク（week_number が一致するタスク）も週の目標に合わせて提案する。\n"
        "- 週次(weekly)の目標が修正された場合: その週に属する日次(daily)タスク（week_number が一致するタスク）を、修正後の週次目標に合わせて提案する。\n"
        "- ドラフトタスクの month / week_number / date を見て、どのタスクがどの月・週に属するか判断すること。\n\n"
        "ルール:\n"
        "- proposalsは最大40件まで（例: 12ヶ月分の月次＋4週の週次＋日次など、カスケードで必要な件数が多くなるため）\n"
        "- target_type は monthly/weekly/daily/subtask のいずれか\n"
        "- subtask提案時は subtask_index を必ず指定\n"
        "- task提案時は before/after はタイトル文言\n"
        "- subtask提案時は before/after はサブタスク文言\n"
        "- 優先順位: 月次 > 週次 > 日次（年次修正時はまず月次を全て提案し、余裕があれば週次・日次を追加）\n"
        "- ユーザーが最終目標の文言そのものを変更したい場合（例: 「最終目標を78kgに変更」「目標を〇〇にして」）: "
        "JSONに new_goal_title を1つ含める。変更不要の場合は省略。\n"
        "- **各提案の target_task_id は、必ず下記ドラフトタスクの task_id のいずれかと完全に一致させること。** 存在しないIDを指定すると提案は無効になる。\n"
        '形式: {"assistant_message":"...","proposals":[{"target_task_id":<数値>,"target_type":"monthly"|"weekly"|"daily"|"subtask","before":"現在の文言","after":"修正後の文言","reason":"理由"},...],"new_goal_title":"..." または省略}\n\n'
        f"今日の日付（参照用）: {today_iso}\n"
        f"長期目標（最終目標）: {goal_title}\n"
        f"会話履歴: {json.dumps(history_payload, ensure_ascii=False)}\n"
        f"ユーザーメッセージ: {message}\n"
        f"ドラフトタスク（各タスクに date/month/week_number が含まれる場合、そのタスクの期間を示す）: {json.dumps(draft_payload, ensure_ascii=False, default=str)}"
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
    new_goal_title = parsed.get("new_goal_title")
    if isinstance(new_goal_title, str):
        new_goal_title = new_goal_title.strip() or None
    else:
        new_goal_title = None

    if not isinstance(proposals_raw, list):
        return RevisionChatResponse(
            source="fallback",
            assistant_message=assistant_message,
            proposals=[],
            new_goal_title=new_goal_title,
        )

    valid_task_map = {task.task_id: task for task in draft_tasks}
    proposals: list[TaskRevisionProposal] = []
    for item in proposals_raw:
        if not isinstance(item, dict):
            continue
        raw_id = item.get("target_task_id")
        if raw_id is None:
            continue
        if isinstance(raw_id, str) and raw_id.isdigit():
            task_id = int(raw_id)
        elif isinstance(raw_id, int):
            task_id = raw_id
        elif isinstance(raw_id, float) and raw_id == int(raw_id):
            task_id = int(raw_id)
        else:
            continue
        target_type = str(item.get("target_type", "")).strip().lower()
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

    if not proposals and proposals_raw:
        logger.warning(
            "Revision: AI returned %d raw proposals but all were filtered out. valid_task_ids=%s",
            len(proposals_raw),
            list(valid_task_map.keys()),
        )

    return RevisionChatResponse(
        source="gemini",
        assistant_message=assistant_message,
        proposals=proposals,
        new_goal_title=new_goal_title,
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

    monthly_titles = [_strip_period_prefix(t) for t in _parse_titles(ai.get("monthly"), "月間マイルストーン", months)]
    # AIが今月（1件目）を返さない場合に備え、先頭に今月分を1件補完する
    if len(monthly_titles) >= 1 and len(monthly_titles) < months:
        fallback_first = (goal.title or "今月の目標").strip()
        monthly_titles = [fallback_first] + monthly_titles
    monthly_titles = monthly_titles[:months]
    weekly_titles = [_strip_period_prefix(t) for t in _parse_titles(ai.get("weekly"), "週次タスク", weeks_per_month)]
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
        day_date = today + dt.timedelta(days=idx)
        daily.append(
            BreakdownTask(
                type=TaskType.daily,
                title=title,
                month=day_date.month,
                week_number=day_date.isocalendar().week,
                date=day_date,
                note=note,
            )
        )

    return BreakdownResponse(source="gemini", monthly=monthly, weekly=weekly, daily=daily)