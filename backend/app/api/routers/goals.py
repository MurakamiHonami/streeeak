from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.db import repositories as repo
from app.schemas.goal import GoalCreate, GoalRead, GoalUpdate
from app.schemas.task import TaskType
from app.services.task_service import build_breakdown, parse_note_subtasks

router = APIRouter(prefix="/goals", tags=["goals"])


class BreakdownRequest(BaseModel):
    months: int = 12
    weeks_per_month: int = 4
    days_per_week: int = 7
    persist: bool = True
    current_situation: Optional[str] = None


@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, current_user: dict = Depends(get_current_user)):
    user_id = payload.user_id or int(current_user["id"])
    goal = repo.create_goal(user_id=user_id, title=payload.title, deadline=payload.deadline)
    return GoalRead.model_validate(repo.to_goal_read(goal))


@router.get("", response_model=list[GoalRead])
def list_goals(current_user: dict = Depends(get_current_user)):
    goals = repo.list_goals_by_user(int(current_user["id"]))
    return [GoalRead.model_validate(repo.to_goal_read(g)) for g in goals]


@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(goal_id: int, current_user: dict = Depends(get_current_user)):
    goal = repo.get_goal(goal_id)
    if not goal or int(goal["user_id"]) != int(current_user["id"]):
        raise HTTPException(status_code=404, detail="Goal not found")
    return GoalRead.model_validate(repo.to_goal_read(goal))


@router.put("/{goal_id}", response_model=GoalRead)
def update_goal(goal_id: int, payload: GoalUpdate, current_user: dict = Depends(get_current_user)):
    goal = repo.get_goal(goal_id)
    if not goal or int(goal["user_id"]) != int(current_user["id"]):
        raise HTTPException(status_code=404, detail="Goal not found")
    updated = repo.update_goal(goal_id, payload.model_dump(exclude_none=True)) or goal
    return GoalRead.model_validate(repo.to_goal_read(updated))


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, current_user: dict = Depends(get_current_user)):
    goal = repo.get_goal(goal_id)
    if not goal or int(goal["user_id"]) != int(current_user["id"]):
        raise HTTPException(status_code=404, detail="Goal not found")
    repo.delete_tasks_by_goal(goal_id)
    repo.delete_goal(goal_id)


@router.post("/{goal_id}/tasks/breakdown")
def generate_breakdown(
    goal_id: int,
    payload: BreakdownRequest,
    current_user: dict = Depends(get_current_user),
):
    goal = repo.get_goal(goal_id)
    if not goal or int(goal["user_id"]) != int(current_user["id"]):
        raise HTTPException(status_code=404, detail="Goal not found")

    breakdown_res = build_breakdown(
        goal_title=goal["title"],
        months=payload.months,
        weeks_per_month=payload.weeks_per_month,
        days_per_week=payload.days_per_week,
        current_situation=payload.current_situation,
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
