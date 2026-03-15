import datetime as dt
import json
import logging
import re
import uuid

import httpx

from app.core.config import settings
from app.schemas.task import (
    BreakdownResponse,
    BreakdownTask,
    DraftTask,
    RevisionChatMessage,
    RevisionChatResponse,
    TaskRevisionProposal,
    TaskType,
)

logger = logging.getLogger(__name__)


def derive_breakdown_scope(deadline: dt.date | str | None) -> tuple[int, int, int, int]:
    if deadline is None:
        return 12, 4, 7, 12

    if isinstance(deadline, str):
        try:
            deadline_date = dt.date.fromisoformat(deadline)
        except ValueError:
            return 12, 4, 7, 12
    else:
        deadline_date = deadline

    today = dt.date.today()
    if deadline_date <= today:
        return 1, 1, 1, 1

    total_days = (deadline_date - today).days
    months = max(1, min(24, (total_days + 29) // 30))
    weeks_per_month = max(1, min(5, total_days // max(1, months * 7)))
    days_per_week = 7
    yearly_milestones = max(1, min(12, months))
    return months, weeks_per_month, days_per_week, yearly_milestones


def _fallback_breakdown(goal_title: str, months: int, weeks_per_month: int, days_per_week: int) -> BreakdownResponse:
    today = dt.date.today()
    current_week = today.isocalendar().week

    monthly = [
        BreakdownTask(type=TaskType.monthly, title=f"{goal_title} - monthly {i + 1}", month=((today.month - 1 + i) % 12) + 1)
        for i in range(months)
    ]
    weekly = [
        BreakdownTask(type=TaskType.weekly, title=f"{goal_title} - weekly {i + 1}", month=today.month, week_number=current_week + i)
        for i in range(weeks_per_month)
    ]
    daily = [
        BreakdownTask(
            type=TaskType.daily,
            title=f"{goal_title} - daily {i + 1}",
            month=(today + dt.timedelta(days=i)).month,
            week_number=(today + dt.timedelta(days=i)).isocalendar().week,
            date=today + dt.timedelta(days=i),
            note=compose_note_subtasks(
                [
                    "Define concrete outcome",
                    "Work for 25 minutes",
                    "Write quick review",
                ]
            ),
        )
        for i in range(days_per_week)
    ]
    return BreakdownResponse(source="fallback", monthly=monthly, weekly=weekly, daily=daily)


def _call_gemini_json(prompt: str) -> dict:
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.6, "response_mime_type": "application/json"},
    }
    model_candidates = [settings.GEMINI_MODEL, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"]

    for version in ["v1beta", "v1"]:
        for model in model_candidates:
            url = f"https://generativelanguage.googleapis.com/{version}/models/{model}:generateContent?key={settings.GEMINI_API_KEY}"
            response = httpx.post(url, json=payload, timeout=45.0)
            if response.status_code == 404:
                continue
            response.raise_for_status()
            body = response.json()
            text = body.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "{}")
            cleaned = re.sub(r"^```json\s*|```$", "", text.strip())
            return json.loads(cleaned)

    raise ValueError("No available Gemini model/endpoint was found")


def parse_note_subtasks(note: str | None) -> list[str]:
    if not note:
        return []
    return [line.replace("- ", "", 1).strip() for line in note.splitlines() if line.replace("- ", "", 1).strip()]


def compose_note_subtasks(subtasks: list[str]) -> str:
    return "\n".join([f"- {item.strip()}" for item in subtasks if item.strip()])


def generate_revision_suggestions(
    goal_title: str,
    message: str,
    draft_tasks: list[DraftTask],
    chat_history: list[RevisionChatMessage],
) -> RevisionChatResponse:
    if not draft_tasks:
        return RevisionChatResponse(source="fallback", assistant_message="No tasks to revise.", proposals=[])

    if not settings.GEMINI_API_KEY:
        return RevisionChatResponse(source="fallback", assistant_message="Gemini key is not configured.", proposals=[])

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
        "Return JSON only. Suggest up to 8 revisions."
        ' Format: {"assistant_message":"...","proposals":[{"target_task_id":1,"target_type":"daily|weekly|monthly|subtask","subtask_index":0,"before":"...","after":"...","reason":"..."}]}. '
        f"Goal: {goal_title}. Message: {message}. History: {json.dumps(history_payload, ensure_ascii=False)}. Drafts: {json.dumps(draft_payload, ensure_ascii=False)}"
    )

    try:
        parsed = _call_gemini_json(prompt)
    except Exception as e:
        logger.exception("Gemini revision failed: %s", e)
        return RevisionChatResponse(source="fallback", assistant_message="Gemini request failed.", proposals=[])

    proposals_raw = parsed.get("proposals", [])
    proposals = []
    valid_task_ids = {x.task_id for x in draft_tasks}
    for item in proposals_raw:
        if not isinstance(item, dict):
            continue
        task_id = item.get("target_task_id")
        target_type = str(item.get("target_type", ""))
        if task_id not in valid_task_ids:
            continue
        if target_type not in {"monthly", "weekly", "daily", "subtask"}:
            continue
        subtask_index = item.get("subtask_index") if target_type == "subtask" else None
        proposals.append(
            TaskRevisionProposal(
                proposal_id=str(uuid.uuid4()),
                target_task_id=task_id,
                target_type=target_type,
                subtask_index=subtask_index,
                before=str(item.get("before", "")).strip(),
                after=str(item.get("after", "")).strip(),
                reason=str(item.get("reason", "")).strip() or "Improved wording",
            )
        )

    if not proposals and proposals_raw:
        logger.warning(
            "Revision: AI returned %d raw proposals but all were filtered out. valid_task_ids=%s",
            len(proposals_raw),
            sorted(valid_task_ids),
        )

    return RevisionChatResponse(
        source="gemini",
        assistant_message=str(parsed.get("assistant_message", "Suggestions generated.")),
        proposals=proposals,
        new_goal_title=parsed.get("new_goal_title"),
    )


def build_breakdown(
    goal_title: str,
    months: int,
    weeks_per_month: int,
    days_per_week: int,
    current_situation: str | None = None,
) -> BreakdownResponse:
    if not settings.GEMINI_API_KEY:
        return _fallback_breakdown(goal_title, months, weeks_per_month, days_per_week)

    prompt = (
        "Return JSON only with keys monthly, weekly, daily as arrays of titles. "
        f"Goal: {goal_title}. Situation: {current_situation or 'n/a'}. Months={months}, Weeks={weeks_per_month}, Days={days_per_week}."
    )
    try:
        parsed = _call_gemini_json(prompt)
        monthly_titles = [str(x).strip() for x in parsed.get("monthly", []) if str(x).strip()][:months] or [f"{goal_title} - monthly {i+1}" for i in range(months)]
        weekly_titles = [str(x).strip() for x in parsed.get("weekly", []) if str(x).strip()][:weeks_per_month] or [f"{goal_title} - weekly {i+1}" for i in range(weeks_per_month)]
        daily_titles = [str(x).strip() for x in parsed.get("daily", []) if str(x).strip()][:days_per_week] or [f"{goal_title} - daily {i+1}" for i in range(days_per_week)]
    except Exception as e:
        logger.exception("Gemini breakdown failed: %s", e)
        return _fallback_breakdown(goal_title, months, weeks_per_month, days_per_week)

    today = dt.date.today()
    current_week = today.isocalendar().week

    monthly = [
        BreakdownTask(type=TaskType.monthly, title=title, month=((today.month - 1 + i) % 12) + 1)
        for i, title in enumerate(monthly_titles)
    ]
    weekly = [
        BreakdownTask(type=TaskType.weekly, title=title, month=today.month, week_number=current_week + i)
        for i, title in enumerate(weekly_titles)
    ]
    daily = [
        BreakdownTask(
            type=TaskType.daily,
            title=title,
            month=(today + dt.timedelta(days=i)).month,
            week_number=(today + dt.timedelta(days=i)).isocalendar().week,
            date=today + dt.timedelta(days=i),
            note=compose_note_subtasks(["Define concrete outcome", "Work for 25 minutes", "Write quick review"]),
        )
        for i, title in enumerate(daily_titles)
    ]

    return BreakdownResponse(source="gemini", monthly=monthly, weekly=weekly, daily=daily)
