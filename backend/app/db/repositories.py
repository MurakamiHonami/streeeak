from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.core.config import settings
from app.db import dynamo
from app.db.serializers import now_iso, parse_date, parse_dt, parse_time


def _sort_by_created_desc(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(items, key=lambda x: x.get("created_at", ""), reverse=True)


def create_user(email: str, name: str, password_hash: str, verification_token: str | None = None) -> dict[str, Any]:
    user_id = dynamo.next_id("users")
    ts = now_iso()
    item = {
        "id": user_id,
        "email": email,
        "name": name,
        "avatar_url": None,
        "password_hash": password_hash,
        "is_verified": False,
        "verification_token": verification_token,
        "is_premium": False,
        "created_at": ts,
        "updated_at": ts,
    }
    dynamo.put_item(settings.USERS_TABLE, item)
    dynamo.put_item(settings.USER_SETTINGS_TABLE, {"user_id": user_id, "auto_post_time": None})
    return item


def get_user(user_id: int) -> dict[str, Any] | None:
    return dynamo.get_item(settings.USERS_TABLE, {"id": user_id})


def get_user_by_email(email: str) -> dict[str, Any] | None:
    items = dynamo.query_gsi(settings.USERS_TABLE, "EmailIndex", "email", email)
    return items[0] if items else None


def get_user_by_verification_token(token: str) -> dict[str, Any] | None:
    users = dynamo.scan_all(settings.USERS_TABLE)
    for u in users:
        if u.get("verification_token") == token:
            return u
    return None


def update_user(user_id: int, updates: dict[str, Any]) -> dict[str, Any] | None:
    item = get_user(user_id)
    if not item:
        return None
    item.update(updates)
    item["updated_at"] = now_iso()
    dynamo.put_item(settings.USERS_TABLE, item)
    return item


def delete_user(user_id: int) -> None:
    dynamo.delete_item(settings.USERS_TABLE, {"id": user_id})
    dynamo.delete_item(settings.USER_SETTINGS_TABLE, {"user_id": user_id})


def get_user_settings(user_id: int) -> dict[str, Any]:
    item = dynamo.get_item(settings.USER_SETTINGS_TABLE, {"user_id": user_id})
    if item:
        return item
    item = {"user_id": user_id, "auto_post_time": None}
    dynamo.put_item(settings.USER_SETTINGS_TABLE, item)
    return item


def update_user_settings(user_id: int, auto_post_time: str | None) -> dict[str, Any]:
    item = get_user_settings(user_id)
    item["auto_post_time"] = auto_post_time
    dynamo.put_item(settings.USER_SETTINGS_TABLE, item)
    return item


def create_goal(user_id: int, title: str, deadline: date | None) -> dict[str, Any]:
    goal_id = dynamo.next_id("goals")
    ts = now_iso()
    item = {
        "id": goal_id,
        "user_id": user_id,
        "title": title,
        "deadline": deadline.isoformat() if deadline else None,
        "created_at": ts,
        "updated_at": ts,
    }
    dynamo.put_item(settings.GOALS_TABLE, item)
    return item


def get_goal(goal_id: int) -> dict[str, Any] | None:
    return dynamo.get_item(settings.GOALS_TABLE, {"id": goal_id})


def list_goals_by_user(user_id: int) -> list[dict[str, Any]]:
    return _sort_by_created_desc(dynamo.query_gsi(settings.GOALS_TABLE, "UserIdIndex", "user_id", user_id))


def update_goal(goal_id: int, updates: dict[str, Any]) -> dict[str, Any] | None:
    goal = get_goal(goal_id)
    if not goal:
        return None
    for k, v in updates.items():
        goal[k] = v.isoformat() if isinstance(v, date) else v
    goal["updated_at"] = now_iso()
    dynamo.put_item(settings.GOALS_TABLE, goal)
    return goal


def delete_goal(goal_id: int) -> None:
    dynamo.delete_item(settings.GOALS_TABLE, {"id": goal_id})


def create_task(payload: dict[str, Any]) -> dict[str, Any]:
    task_id = dynamo.next_id("tasks")
    ts = now_iso()
    item = {
        "id": task_id,
        "goal_id": payload.get("goal_id"),
        "user_id": payload["user_id"],
        "type": getattr(payload["type"], "value", payload["type"]),
        "title": payload["title"],
        "month": payload.get("month"),
        "week_number": payload.get("week_number"),
        "date": payload.get("date").isoformat() if payload.get("date") else None,
        "tags": payload.get("tags"),
        "note": payload.get("note"),
        "priority": getattr(payload.get("priority"), "value", payload.get("priority") or "mid"),
        "status": getattr(payload.get("status"), "value", payload.get("status") or "todo"),
        "is_done": bool(payload.get("is_done", False)),
        "carried_over": bool(payload.get("carried_over", False)),
        "created_at": ts,
        "updated_at": ts,
    }
    dynamo.put_item(settings.TASKS_TABLE, item)
    return item


def get_task(task_id: int) -> dict[str, Any] | None:
    return dynamo.get_item(settings.TASKS_TABLE, {"id": task_id})


def update_task(task_id: int, updates: dict[str, Any]) -> dict[str, Any] | None:
    task = get_task(task_id)
    if not task:
        return None
    for k, v in updates.items():
        if isinstance(v, date):
            task[k] = v.isoformat()
        elif k in {"type", "priority", "status"}:
            task[k] = getattr(v, "value", v)
        else:
            task[k] = v
    task["updated_at"] = now_iso()
    dynamo.put_item(settings.TASKS_TABLE, task)
    return task


def delete_task(task_id: int) -> None:
    dynamo.delete_item(settings.TASKS_TABLE, {"id": task_id})


def list_tasks_by_goal(goal_id: int) -> list[dict[str, Any]]:
    items = dynamo.query_gsi(settings.TASKS_TABLE, "GoalIdIndex", "goal_id", goal_id)
    return sorted(items, key=lambda x: (str(x.get("type", "")), str(x.get("date", "")), x.get("id", 0)))


def list_tasks_by_user(user_id: int) -> list[dict[str, Any]]:
    return _sort_by_created_desc(dynamo.query_gsi(settings.TASKS_TABLE, "UserIdIndex", "user_id", user_id))


def delete_tasks_by_goal(goal_id: int) -> None:
    for item in list_tasks_by_goal(goal_id):
        delete_task(item["id"])


def to_user_read(item: dict[str, Any], settings_item: dict[str, Any] | None = None) -> dict[str, Any]:
    return {
        "id": int(item["id"]),
        "email": item["email"],
        "name": item["name"],
        "avatar_url": item.get("avatar_url"),
        "is_premium": bool(item.get("is_premium", False)),
        "created_at": parse_dt(item["created_at"]),
        "updated_at": parse_dt(item["updated_at"]),
        "auto_post_time": parse_time(settings_item.get("auto_post_time") if settings_item else None),
    }


def to_goal_read(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(item["id"]),
        "user_id": int(item["user_id"]),
        "title": item["title"],
        "deadline": parse_date(item.get("deadline")),
        "created_at": parse_dt(item["created_at"]),
        "updated_at": parse_dt(item["updated_at"]),
    }


def to_task_read(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(item["id"]),
        "goal_id": item.get("goal_id"),
        "user_id": int(item["user_id"]),
        "type": item["type"],
        "title": item["title"],
        "month": item.get("month"),
        "week_number": item.get("week_number"),
        "date": parse_date(item.get("date")),
        "tags": item.get("tags"),
        "note": item.get("note"),
        "priority": item.get("priority") or "mid",
        "status": item.get("status") or "todo",
        "is_done": bool(item.get("is_done", False)),
        "carried_over": bool(item.get("carried_over", False)),
        "created_at": parse_dt(item["created_at"]),
        "updated_at": parse_dt(item["updated_at"]),
    }
