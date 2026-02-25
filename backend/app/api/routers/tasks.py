import math
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


def _merge_or_move_daily_task(db: Session, task: Task, target_date: date) -> Task:
    """
    Move a daily task to target_date.
    If an equivalent task already exists on target_date, merge into the existing row
    and delete the source row to avoid duplicate carry-over records.
    """
    duplicate = db.scalar(
        select(Task).where(
            Task.id != task.id,
            Task.user_id == task.user_id,
            Task.goal_id == task.goal_id,
            Task.type == TaskType.daily,
            Task.date == target_date,
            Task.title == task.title,
            Task.tags == task.tags,
            Task.note == task.note,
        )
    )
    if duplicate:
        duplicate.carried_over = True
        # 未完了タスクを持ち越した場合は、重複先も未完了に揃える
        if not task.is_done:
            duplicate.is_done = False
        db.delete(task)
        return duplicate

    task.date = target_date
    task.carried_over = True
    return task


def _add_months(base: date, months: int) -> date:
    year = base.year + (base.month - 1 + months) // 12
    month = ((base.month - 1 + months) % 12) + 1
    month_days = [31, 29 if (year % 400 == 0 or (year % 4 == 0 and year % 100 != 0)) else 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
    day = min(base.day, month_days[month - 1])
    return date(year, month, day)


def _ceil_months_between(start: date, end: date) -> int:
    base_months = (end.year - start.year) * 12 + (end.month - start.month)
    anchor = _add_months(start, base_months)
    if anchor < end:
        return base_months + 1
    return max(0, base_months)


def _derive_breakdown_scope(deadline: date) -> tuple[int, int, int, int]:
    """
    Returns (months, weeks, days, yearly_milestones) derived from deadline.
    - < 1 month: monthly 0, weekly ceil(days/7), daily = days
    - 1 month ~ 1 year: monthly ceil(days/30), weekly 4, daily 7
    - > 1 year: monthly ceil(days/30), yearly milestones ceil(months/12), weekly 4, daily 7
    """
    today = date.today()
    total_days = max(1, (deadline - today).days + 1)

    if total_days < 30:
        weeks = max(1, math.ceil(total_days / 7))
        return (0, weeks, total_days, 0)

    months = max(1, _ceil_months_between(today, deadline))
    yearly_milestones = math.ceil(months / 12) if months > 12 else 0
    return (months, 4, 7, yearly_milestones)


@router.post("/goals/{goal_id}/tasks/breakdown", response_model=BreakdownResponse)
def create_breakdown(goal_id: int, payload: BreakdownRequest, db: Session = Depends(get_db)):
    goal = db.get(Goal, goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    months = payload.months
    weeks_per_month = payload.weeks_per_month
    days_per_week = payload.days_per_week
    yearly_milestones = 0

    # 期限がある場合は、期間に合わせて分解粒度を自動調整する
    if goal.deadline:
        months, weeks_per_month, days_per_week, yearly_milestones = _derive_breakdown_scope(goal.deadline)

    breakdown = build_breakdown(
        goal,
        months,
        weeks_per_month,
        days_per_week,
        yearly_milestones=yearly_milestones,
        current_situation=payload.current_situation,
    )
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
    # 日次一覧取得時に、未完了タスクを日付変更に追従させる（翌日へ持ち越し）
    if type == TaskType.daily and date_value is not None:
        overdue_tasks = list(
            db.scalars(
                select(Task).where(
                    Task.user_id == user_id,
                    Task.type == TaskType.daily,
                    Task.is_done.is_(False),
                    Task.date.is_not(None),
                    Task.date < date_value,
                )
            )
        )
        for task in overdue_tasks:
            # 1日ずつ持ち越す意図を保ちつつ、取得対象日より未来にはしない
            next_date = task.date + timedelta(days=1)
            _merge_or_move_daily_task(db, task, min(next_date, date_value))
        if overdue_tasks:
            db.commit()

    stmt = select(Task).where(Task.user_id == user_id, Task.type == type)
    if type == TaskType.monthly and month is not None:
        stmt = stmt.where(Task.month == month)
    if type == TaskType.weekly and week_number is not None:
        stmt = stmt.where(Task.week_number == week_number)
    if type == TaskType.daily:
        if week_number is not None:
            stmt = stmt.where(Task.week_number == week_number)
        if date_value is not None:
            stmt = stmt.where(Task.date == date_value)
    return list(db.scalars(stmt.order_by(Task.created_at.desc())))


@router.put("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    updates = payload.model_dump(exclude_none=True)

    # 完了済みdailyタスクは日付変更(持ち越し)不可: 未完了のみ移動可能にする
    if (
        task.type == TaskType.daily
        and task.is_done
        and "date" in updates
        and updates["date"] != task.date
    ):
        raise HTTPException(status_code=400, detail="Completed daily task cannot be carried over")

    for field, value in updates.items():
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
    if task.is_done:
        raise HTTPException(status_code=400, detail="Completed task cannot be carried over")

    # 同一タスクの日付を翌日に移動して持ち越す
    task.is_done = False
    moved_task = _merge_or_move_daily_task(db, task, task.date + timedelta(days=1))
    db.commit()
    db.refresh(moved_task)
    return moved_task


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
