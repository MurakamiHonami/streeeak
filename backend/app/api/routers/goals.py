from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_optional_current_user
from app.db import repositories as repo
from app.schemas.goal import GoalCreate, GoalRead, GoalUpdate
from app.schemas.task import TaskType
from app.services.task_service import build_breakdown, derive_breakdown_scope, parse_note_subtasks

router = APIRouter(prefix="/goals", tags=["goals"])


class BreakdownRequest(BaseModel):
    months: int = 12
    weeks_per_month: int = 4
    days_per_week: int = 7
    persist: bool = True
    current_situation: Optional[str] = None


def _resolve_user_id(current_user: dict | None, fallback_user_id: int | None = None) -> int:
    if current_user:
        return int(current_user["id"])
    if fallback_user_id is None:
        raise HTTPException(status_code=400, detail="user_id is required for guest access")
    return int(fallback_user_id)


def _ensure_goal_access(goal: dict | None, current_user: dict | None = None):
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    if current_user and int(goal["user_id"]) != int(current_user["id"]):
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, current_user: dict | None = Depends(get_optional_current_user)):
    user_id = _resolve_user_id(current_user, payload.user_id)
    goal = repo.create_goal(user_id=user_id, title=payload.title, deadline=payload.deadline)
    return GoalRead.model_validate(repo.to_goal_read(goal))


@router.get("", response_model=list[GoalRead])
def list_goals(user_id: int | None = None, current_user: dict | None = Depends(get_optional_current_user)):
    goals = repo.list_goals_by_user(_resolve_user_id(current_user, user_id))
    return [GoalRead.model_validate(repo.to_goal_read(g)) for g in goals]


@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(goal_id: int, current_user: dict | None = Depends(get_optional_current_user)):
    goal = _ensure_goal_access(repo.get_goal(goal_id), current_user)
    return GoalRead.model_validate(repo.to_goal_read(goal))


@router.put("/{goal_id}", response_model=GoalRead)
def update_goal(goal_id: int, payload: GoalUpdate, current_user: dict | None = Depends(get_optional_current_user)):
    goal = _ensure_goal_access(repo.get_goal(goal_id), current_user)
    updated = repo.update_goal(goal_id, payload.model_dump(exclude_none=True)) or goal
    return GoalRead.model_validate(repo.to_goal_read(updated))


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, current_user: dict | None = Depends(get_optional_current_user)):
    _ensure_goal_access(repo.get_goal(goal_id), current_user)
    repo.delete_tasks_by_goal(goal_id)
    repo.delete_goal(goal_id)


@router.post("/{goal_id}/tasks/breakdown")
def generate_breakdown(
    goal_id: int,
    payload: BreakdownRequest,
    current_user: dict | None = Depends(get_optional_current_user),
):
    goal = _ensure_goal_access(repo.get_goal(goal_id), current_user)

    months = payload.months
    weeks_per_month = payload.weeks_per_month
    days_per_week = payload.days_per_week
    yearly_milestones = 0
    if goal.get("deadline"):
        months, weeks_per_month, days_per_week, yearly_milestones = derive_breakdown_scope(goal.get("deadline"))

    situation = (payload.current_situation or "").strip() or (getattr(goal, "current_situation", None) or "").strip() or None
    breakdown_res = build_breakdown(
        goal_title=goal["title"],
        months=months,
        weeks_per_month=weeks_per_month,
        days_per_week=days_per_week,
        current_situation=situation,
    )

    if payload.persist:
        for item in breakdown_res.monthly + breakdown_res.weekly + breakdown_res.daily:
            if item.type == TaskType.daily:
                subtasks = parse_note_subtasks(item.note)
                if subtasks:
                    for sub in subtasks:
                        repo.create_task(
                            {
                                "goal_id": int(goal["id"]),
                                "user_id": int(goal["user_id"]),
                                "type": TaskType.daily,
                                "title": sub,
                                "month": item.month,
                                "week_number": item.week_number,
                                "date": item.date,
                                "note": None,
                            }
                        )
                    continue
            repo.create_task(
                {
                    "goal_id": int(goal["id"]),
                    "user_id": int(goal["user_id"]),
                    "type": item.type,
                    "title": item.title,
                    "month": item.month,
                    "week_number": item.week_number,
                    "date": item.date,
                    "note": item.note,
                }
            )

    return breakdown_res
