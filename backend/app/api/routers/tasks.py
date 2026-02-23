from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.goal import Goal
from app.models.task import Task, TaskType
from app.schemas.task import (
    ApplyRevisionsRequest,
    ApplyRevisionsResponse,
    BreakdownRequest,
    BreakdownResponse,
    RevisionChatRequest,
    RevisionChatResponse,
    TaskBulkCreate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)
from app.services.task_service import (
    build_breakdown,
    compose_note_subtasks,
    generate_revision_suggestions,
    parse_note_subtasks,
)

router = APIRouter(tags=["tasks"])


@router.post("/goals/{goal_id}/tasks/breakdown", response_model=BreakdownResponse)
def create_breakdown(goal_id: int, payload: BreakdownRequest, db: Session = Depends(get_db)):
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    breakdown = build_breakdown(goal, payload.months, payload.weeks_per_month, payload.days_per_week)
    if payload.persist:
        # 同じ目標の再生成でタスク重複が増えないように既存を消してから再作成
        db.execute(delete(Task).where(Task.goal_id == goal.id))
        for item in breakdown.monthly + breakdown.weekly + breakdown.daily:
            if item.type == TaskType.daily:
                subtasks = parse_note_subtasks(item.note)
                if subtasks:
                    for subtask in subtasks:
                        db.add(
                            Task(
                                goal_id=goal.id,
                                user_id=goal.user_id,
                                type=item.type,
                                title=subtask,
                                month=item.month,
                                week_number=item.week_number,
                                date=item.date,
                                note=None,
                            )
                        )
                    continue
            db.add(
                Task(
                    goal_id=goal.id,
                    user_id=goal.user_id,
                    type=item.type,
                    title=item.title,
                    month=item.month,
                    week_number=item.week_number,
                    date=item.date,
                    note=item.note,
                )
            )
        db.commit()
    return breakdown


@router.get("/goals/{goal_id}/tasks", response_model=list[TaskRead])
def list_goal_tasks(goal_id: int, db: Session = Depends(get_db)):
    if not db.get(Goal, goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")
    stmt = select(Task).where(Task.goal_id == goal_id).order_by(Task.type, Task.date, Task.id)
    return list(db.scalars(stmt))


@router.post("/goals/{goal_id}/tasks/revision-chat", response_model=RevisionChatResponse)
def revision_chat(goal_id: int, payload: RevisionChatRequest, db: Session = Depends(get_db)):
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return generate_revision_suggestions(
        goal_title=goal.title,
        message=payload.message,
        draft_tasks=payload.draft_tasks,
        chat_history=payload.chat_history,
    )


@router.post("/goals/{goal_id}/tasks/revisions/apply", response_model=ApplyRevisionsResponse)
def apply_revisions(goal_id: int, payload: ApplyRevisionsRequest, db: Session = Depends(get_db)):
    if not db.get(Goal, goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")

    touched_ids: set[int] = set()
    for proposal in payload.accepted_proposals:
        task = db.get(Task, proposal.target_task_id)
        if not task or task.goal_id != goal_id:
            continue
        if proposal.target_type == "subtask":
            if proposal.subtask_index is None:
                continue
            subtasks = parse_note_subtasks(task.note)
            if proposal.subtask_index < 0 or proposal.subtask_index >= len(subtasks):
                continue
            subtasks[proposal.subtask_index] = proposal.after
            task.note = compose_note_subtasks(subtasks)
        else:
            task.title = proposal.after
        touched_ids.add(task.id)

    db.commit()
    updated_tasks: list[Task] = []
    for task_id in touched_ids:
        task = db.get(Task, task_id)
        if task:
            db.refresh(task)
            updated_tasks.append(task)
    return ApplyRevisionsResponse(updated_tasks=updated_tasks)


@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate, db: Session = Depends(get_db)):
    task = Task(**payload.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.post("/tasks/bulk", response_model=list[TaskRead], status_code=status.HTTP_201_CREATED)
def create_tasks_bulk(payload: TaskBulkCreate, db: Session = Depends(get_db)):
    created: list[Task] = []
    for raw in payload.tasks:
        task = Task(**raw.model_dump())
        db.add(task)
        created.append(task)
    db.commit()
    for task in created:
        db.refresh(task)
    return created


@router.get("/tasks", response_model=list[TaskRead])
def list_tasks(
    user_id: int,
    type: TaskType,
    month: int | None = None,
    week_number: int | None = None,
    date_value: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db),
):
    stmt = select(Task).where(Task.user_id == user_id, Task.type == type)
    if type == TaskType.monthly and month is not None:
        stmt = stmt.where(Task.month == month)
    if type == TaskType.weekly and week_number is not None:
        stmt = stmt.where(Task.week_number == week_number)
    if type == TaskType.daily and date_value is not None:
        stmt = stmt.where(Task.date == date_value)
    return list(db.scalars(stmt.order_by(Task.created_at.desc())))


@router.put("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/tasks/{task_id}/done", response_model=TaskRead)
def toggle_done(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    task.is_done = not task.is_done
    db.commit()
    db.refresh(task)
    return task


@router.post("/tasks/{task_id}/carry-over", response_model=TaskRead)
def carry_over_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.type != TaskType.daily or task.date is None:
        raise HTTPException(status_code=400, detail="Carry-over is only for daily tasks")

    task.carried_over = True
    new_task = Task(
        goal_id=task.goal_id,
        user_id=task.user_id,
        type=TaskType.daily,
        title=task.title,
        date=task.date + timedelta(days=1),
        is_done=False,
        carried_over=False,
        tags=task.tags,
        note=task.note,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
