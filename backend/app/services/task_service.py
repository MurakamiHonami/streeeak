import datetime as dt
import json
import logging
import re
import uuid
from collections.abc import Callable

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

# 各曜日（月〜日）に生成するデイリータスク数
DAILY_TASKS_PER_DAY = 3


def derive_breakdown_scope(deadline: dt.date | str | None) -> tuple[int, int, int, int]:
    """Returns (months, weeks_per_month, days_per_week, yearly_milestones).

    Weekly tasks are always 4 (≈1 month split into 4 weeks).
    days_per_week is how many consecutive calendar days of dailies (starting from the generation date); each day gets DAILY_TASKS_PER_DAY tasks.
    """
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
    # Fixed cadence: month → 4 weekly goals → current week → 7 days × DAILY_TASKS_PER_DAY tasks
    weeks_per_month = 4
    days_per_week = 7
    yearly_milestones = max(1, min(12, months))
    return months, weeks_per_month, days_per_week, yearly_milestones


def _daily_span_from_anchor(anchor: dt.date, num_days: int) -> list[dt.date]:
    """Consecutive calendar days: ``anchor`` is day 1, then anchor+1, … (``num_days`` days)."""
    return [anchor + dt.timedelta(days=i) for i in range(num_days)]


def _ensure_title_list(raw: list, n: int, fallback_title: Callable[[int], str]) -> list[str]:
    titles = [str(x).strip() for x in raw if x is not None and str(x).strip()]
    titles = titles[:n]
    while len(titles) < n:
        titles.append(fallback_title(len(titles)))
    return titles


def _normalize_daily_groups(
    raw: object,
    num_days: int,
    per_day: int,
    goal_title: str,
) -> list[list[str]]:
    """Build ``num_days`` groups of ``per_day`` titles from Gemini ``daily`` (nested or flat)."""

    def fallback_title(day_idx: int, slot_idx: int) -> str:
        return f"{goal_title} - デイリー {day_idx + 1}日目 タスク{slot_idx + 1}"

    # Preferred: [["1日目1","1日目2",...], ["2日目1",...], ...] — one inner array per consecutive day from generation date
    if isinstance(raw, list) and raw and isinstance(raw[0], list):
        groups: list[list[str]] = []
        for day_i in range(num_days):
            row = raw[day_i] if day_i < len(raw) and isinstance(raw[day_i], list) else []
            titles = [str(x).strip() for x in row if x is not None and str(x).strip()]
            titles = titles[:per_day]
            while len(titles) < per_day:
                titles.append(fallback_title(day_i, len(titles)))
            groups.append(titles)
        return groups

    # Flat: 21 strings in order (day1×3, day2×3, ...) or legacy 7 strings (one per day)
    flat: list[str] = []
    if isinstance(raw, list):
        for x in raw:
            if isinstance(x, (list, dict)):
                continue
            if x is None:
                continue
            s = str(x).strip()
            if s:
                flat.append(s)

    need = num_days * per_day
    if len(flat) >= need:
        flat = flat[:need]
        return [flat[i * per_day : (i + 1) * per_day] for i in range(num_days)]

    # Legacy Gemini: exactly one string per calendar day
    if len(flat) == num_days:
        out: list[list[str]] = []
        for day_i in range(num_days):
            base = flat[day_i]
            row = [base]
            for slot in range(1, per_day):
                row.append(f"{base}（内訳{slot + 1}）")
            out.append(row)
        return out

    # Partial flat list: use as many full per_day groups as possible, then pad days
    full_groups = len(flat) // per_day
    if full_groups >= 1:
        chunks = [flat[i * per_day : (i + 1) * per_day] for i in range(full_groups)]
        while len(chunks) < num_days:
            di = len(chunks)
            chunks.append([fallback_title(di, k) for k in range(per_day)])
        return chunks[:num_days]

    i = 0
    while len(flat) < need:
        flat.append(fallback_title(i // per_day, i % per_day))
        i += 1
    return [flat[i * per_day : (i + 1) * per_day] for i in range(num_days)]


def _daily_tasks_from_groups(day_dates: list[dt.date], groups: list[list[str]]) -> list[BreakdownTask]:
    tasks: list[BreakdownTask] = []
    for d, titles in zip(day_dates, groups):
        for title in titles:
            tasks.append(
                BreakdownTask(
                    type=TaskType.daily,
                    title=title,
                    month=d.month,
                    week_number=d.isocalendar().week,
                    date=d,
                    note=None,
                )
            )
    return tasks


def _fallback_breakdown(goal_title: str, months: int, weeks_per_month: int, days_per_week: int) -> BreakdownResponse:
    today = dt.date.today()

    monthly = [
        BreakdownTask(type=TaskType.monthly, title=f"{goal_title} - monthly {i + 1}", month=((today.month - 1 + i) % 12) + 1)
        for i in range(months)
    ]
    weekly = [
        BreakdownTask(
            type=TaskType.weekly,
            title=f"{goal_title} - weekly {i + 1}",
            month=(today + dt.timedelta(weeks=i)).month,
            week_number=(today + dt.timedelta(weeks=i)).isocalendar().week,
        )
        for i in range(weeks_per_month)
    ]
    day_dates = _daily_span_from_anchor(today, days_per_week)
    daily_groups = [
        [f"{goal_title} - {d.strftime('%m/%d')} タスク{k + 1}" for k in range(DAILY_TASKS_PER_DAY)]
        for d in day_dates
    ]
    daily = _daily_tasks_from_groups(day_dates, daily_groups)
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
        "Return JSON only with keys monthly, weekly, daily. Each value is an array of short, actionable task titles in Japanese.\n"
        f"- monthly: exactly {months} strings — milestones from now toward the goal (deadline horizon).\n"
        f"- weekly: exactly {weeks_per_month} strings — break down the CURRENT month's direction (anchor on the first monthly milestone). "
        "Week 1 = this week, then the next 3 weeks in order.\n"
        f"- daily: exactly {days_per_week} arrays for CONSECUTIVE CALENDAR DAYS starting from TODAY (generation date): "
        f"day 1 = today, day 2 = tomorrow, …, day {days_per_week} = today plus {days_per_week - 1} days. "
        f"Each array must contain exactly {DAILY_TASKS_PER_DAY} distinct short task titles in Japanese for that day, "
        "derived from the FIRST weekly task (focus for the near term). "
        f'Shape example: [["今日のタスク1","今日のタスク2","今日のタスク3"], ["明日1","明日2","明日3"], ...] — outer length '
        f"{days_per_week}, each inner length {DAILY_TASKS_PER_DAY}.\n"
        "Alternatively you may return a single flat array of "
        f"{days_per_week * DAILY_TASKS_PER_DAY} strings in day order (day1 tasks 1–{DAILY_TASKS_PER_DAY}, then day2, ...).\n"
        f"Goal: {goal_title}\nSituation: {current_situation or 'n/a'}\n"
        "Each title must be a concrete, meaningful task description (not numbering only)."
    )
    try:
        parsed = _call_gemini_json(prompt)
        monthly_titles = _ensure_title_list(
            parsed.get("monthly", []),
            months,
            lambda i: f"{goal_title} - monthly {i + 1}",
        )
        weekly_titles = _ensure_title_list(
            parsed.get("weekly", []),
            weeks_per_month,
            lambda i: f"{goal_title} - weekly {i + 1}",
        )
        daily_groups = _normalize_daily_groups(
            parsed.get("daily", []),
            days_per_week,
            DAILY_TASKS_PER_DAY,
            goal_title,
        )
    except Exception as e:
        logger.exception("Gemini breakdown failed: %s", e)
        return _fallback_breakdown(goal_title, months, weeks_per_month, days_per_week)

    today = dt.date.today()

    monthly = [
        BreakdownTask(type=TaskType.monthly, title=title, month=((today.month - 1 + i) % 12) + 1)
        for i, title in enumerate(monthly_titles)
    ]
    weekly = [
        BreakdownTask(
            type=TaskType.weekly,
            title=title,
            month=(today + dt.timedelta(weeks=i)).month,
            week_number=(today + dt.timedelta(weeks=i)).isocalendar().week,
        )
        for i, title in enumerate(weekly_titles)
    ]
    day_dates = _daily_span_from_anchor(today, days_per_week)
    daily = _daily_tasks_from_groups(day_dates, daily_groups)

    return BreakdownResponse(source="gemini", monthly=monthly, weekly=weekly, daily=daily)
