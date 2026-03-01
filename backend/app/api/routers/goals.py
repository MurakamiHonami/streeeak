from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db.session import get_db
from app.models.goal import Goal
from app.models.task import Task, TaskType
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalRead, GoalUpdate
from app.api.deps import get_current_user
from app.services.task_service import build_breakdown, derive_breakdown_scope, parse_note_subtasks

router = APIRouter(prefix="/goals", tags=["goals"])

class BreakdownRequest(BaseModel):
    months: int = 12
    weeks_per_month: int = 4
    days_per_week: int = 7
    persist: bool = True
    current_situation: Optional[str] = None

@router.post("", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
def create_goal(payload: GoalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal_data = payload.model_dump()
    if "user_id" not in goal_data or not goal_data["user_id"]:
        goal_data["user_id"] = current_user.id
    goal = Goal(**goal_data)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal

@router.get("", response_model=list[GoalRead])
def list_goals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return list(db.scalars(select(Goal).where(Goal.user_id == current_user.id).order_by(Goal.created_at.desc())))

@router.get("/{goal_id}", response_model=GoalRead)
def get_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = db.get(Goal, goal_id)
    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")
    return goal

@router.put("/{goal_id}", response_model=GoalRead)
def update_goal(goal_id: int, payload: GoalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = db.get(Goal, goal_id)
    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return goal

@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(goal_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    goal = db.get(Goal, goal_id)
    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.execute(delete(Task).where(Task.goal_id == goal_id))
    db.delete(goal)
    db.commit()

@router.post("/{goal_id}/tasks/breakdown")
def generate_breakdown(
    goal_id: int,
    payload: BreakdownRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    goal = db.get(Goal, goal_id)
    if not goal or goal.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Goal not found")

    months = payload.months
    weeks_per_month = payload.weeks_per_month
    days_per_week = payload.days_per_week
    yearly_milestones = 0
    if goal.deadline:
        months, weeks_per_month, days_per_week, yearly_milestones = derive_breakdown_scope(goal.deadline)

    situation = (payload.current_situation or "").strip() or (getattr(goal, "current_situation", None) or "").strip() or None
    breakdown_res = build_breakdown(
        db=db,
        current_user=current_user,
        goal=goal,
        months=months,
        weeks_per_month=weeks_per_month,
        days_per_week=days_per_week,
        yearly_milestones=yearly_milestones,
        current_situation=situation,
    )

    if payload.persist:
        for m in breakdown_res.monthly:
            db.add(Task(goal_id=goal.id, user_id=goal.user_id, **m.model_dump()))
        for w in breakdown_res.weekly:
            db.add(Task(goal_id=goal.id, user_id=goal.user_id, **w.model_dump()))
        for d in breakdown_res.daily:
            subtasks = parse_note_subtasks(d.note)
            if subtasks:
                for sub in subtasks:
                    db.add(
                        Task(
                            goal_id=goal.id,
                            user_id=goal.user_id,
                            type=TaskType.daily,
                            title=sub,
                            month=d.month,
                            week_number=d.week_number,
                            date=d.date,
                            note=None,
                        )
                    )
            else:
                db.add(Task(goal_id=goal.id, user_id=goal.user_id, **d.model_dump()))
        db.commit()

    return breakdown_res