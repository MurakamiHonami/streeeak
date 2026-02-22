import datetime as dt
import json
import logging
import re
from collections.abc import Sequence

import httpx

from app.core.config import settings
from app.models.goal import Goal
from app.models.task import TaskType
from app.schemas.task import BreakdownResponse, BreakdownTask

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
            response = httpx.post(url, json=payload, timeout=30.0)
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


def _request_gemini_breakdown(goal_title: str, months: int, weeks_per_month: int, days_per_week: int):
    prompt = (
        "あなたは目標分解のプロです。以下をJSONのみで返してください。\n"
        "ルール:\n"
        f"- monthly: 直近{months}ヶ月の目標配列（文字列）\n"
        f"- weekly: 直近1ヶ月の週次目標配列（最大{weeks_per_month}件、文字列）\n"
        f"- daily: 直近1週間の日次TODO配列（最大{days_per_week}件、文字列）\n"
        "- JSON以外の文章は不要\n"
        '形式: {"monthly":["..."],"weekly":["..."],"daily":["..."]}\n'
        f"長期目標: {goal_title}"
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
    # 順序維持で重複除去
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
            response = httpx.post(url, json=payload, timeout=30.0)
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


def build_breakdown(goal: Goal, months: int, weeks_per_month: int, days_per_week: int) -> BreakdownResponse:
    today = dt.date.today()
    this_week_start = _week_start(today)
    current_week = today.isocalendar().week
    current_month = today.month

    # Geminiキーがない場合はフォールバックで壊れず生成する
    if settings.GEMINI_API_KEY:
        try:
            ai = _request_gemini_breakdown(goal.title, months, weeks_per_month, days_per_week)
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
