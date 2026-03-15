from datetime import date, timedelta

from fastapi import APIRouter, HTTPException, Query, status

from app.db import repositories as repo
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
    TaskType,
    TaskUpdate,
)
from app.api.deps import get_current_user
from app.models.user import User
from app.services.task_service import (
    build_breakdown,
    compose_note_subtasks,
    derive_breakdown_scope,
    generate_revision_suggestions,
    parse_note_subtasks,
)

router = APIRouter(tags=["tasks"])


def _sorted(tasks: list[dict]) -> list[dict]:
    return sorted(tasks, key=lambda x: x.get("created_at", ""), reverse=True)


@router.post("/goals/{goal_id}/tasks/breakdown", response_model=BreakdownResponse)
def create_breakdown(goal_id: int, payload: BreakdownRequest):
    goal = repo.get_goal(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")

    breakdown = build_breakdown(
        goal_title=goal["title"],
        months=payload.months,
        weeks_per_month=payload.weeks_per_month,
        days_per_week=payload.days_per_week,
        current_situation=payload.current_situation,
    )

    if payload.persist:
        repo.delete_tasks_by_goal(goal_id)
        for item in breakdown.monthly + breakdown.weekly + breakdown.daily:
            if item.type == TaskType.daily:
                subtasks = parse_note_subtasks(item.note)
                if subtasks:
                    for subtask in subtasks:
                        repo.create_task(
                            {
                                "goal_id": int(goal["id"]),
                                "user_id": int(goal["user_id"]),
                                "type": item.type,
                                "title": subtask,
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
    return breakdown


@router.get("/goals/{goal_id}/tasks", response_model=list[TaskRead])
def list_goal_tasks(goal_id: int):
    if not repo.get_goal(goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")
    items = repo.list_tasks_by_goal(goal_id)
    return [TaskRead.model_validate(repo.to_task_read(x)) for x in items]


@router.post("/goals/{goal_id}/tasks/revision-chat", response_model=RevisionChatResponse)
def revision_chat(goal_id: int, payload: RevisionChatRequest):
    goal = repo.get_goal(goal_id)
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    return generate_revision_suggestions(
        goal_title=goal["title"],
        message=payload.message,
        draft_tasks=payload.draft_tasks,
        chat_history=payload.chat_history,
    )


@router.post("/goals/{goal_id}/tasks/revisions/apply", response_model=ApplyRevisionsResponse)
def apply_revisions(goal_id: int, payload: ApplyRevisionsRequest):
    if not repo.get_goal(goal_id):
        raise HTTPException(status_code=404, detail="Goal not found")

    touched_ids: set[int] = set()
    for proposal in payload.accepted_proposals:
        task = repo.get_task(proposal.target_task_id)
        if not task or int(task.get("goal_id") or 0) != goal_id:
            continue
        if proposal.target_type == "subtask":
            if proposal.subtask_index is None:
                continue
            subtasks = parse_note_subtasks(task.get("note"))
            if proposal.subtask_index < 0 or proposal.subtask_index >= len(subtasks):
                continue
            subtasks[proposal.subtask_index] = proposal.after
            repo.update_task(task["id"], {"note": compose_note_subtasks(subtasks)})
        else:
            repo.update_task(task["id"], {"title": proposal.after})
        touched_ids.add(int(task["id"]))

    updated_tasks = []
    for task_id in touched_ids:
        task = repo.get_task(task_id)
        if task:
            updated_tasks.append(TaskRead.model_validate(repo.to_task_read(task)))
    return ApplyRevisionsResponse(updated_tasks=updated_tasks)


@router.post("/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(payload: TaskCreate):
    task = repo.create_task(payload.model_dump())
    return TaskRead.model_validate(repo.to_task_read(task))


@router.post("/tasks/bulk", response_model=list[TaskRead], status_code=status.HTTP_201_CREATED)
def create_tasks_bulk(payload: TaskBulkCreate):
    created = [repo.create_task(raw.model_dump()) for raw in payload.tasks]
    return [TaskRead.model_validate(repo.to_task_read(x)) for x in created]


@router.get("/tasks", response_model=list[TaskRead])
def list_tasks(
    user_id: int,
    type: TaskType,
    month: int | None = None,
    week_number: int | None = None,
    date_value: date | None = Query(default=None, alias="date"),
):
    tasks = repo.list_tasks_by_user(user_id)

    if type == TaskType.daily and date_value is not None:
        for task in tasks:
            if (
                task.get("type") == TaskType.daily.value
                and not task.get("is_done", False)
                and task.get("date")
                and date.fromisoformat(task["date"]) < date_value
            ):
                next_date = min(date.fromisoformat(task["date"]) + timedelta(days=1), date_value)
                repo.update_task(int(task["id"]), {"date": next_date, "carried_over": True, "is_done": False})
        tasks = repo.list_tasks_by_user(user_id)

    filtered: list[dict] = []
    for t in tasks:
        if t.get("type") != type.value:
            continue
        if type == TaskType.monthly and month is not None and t.get("month") != month:
            continue
        if type == TaskType.weekly and week_number is not None and t.get("week_number") != week_number:
            continue
        if type == TaskType.daily:
            if week_number is not None and t.get("week_number") != week_number:
                continue
            if date_value is not None and t.get("date") != date_value.isoformat():
                continue
        filtered.append(t)

    return [TaskRead.model_validate(repo.to_task_read(x)) for x in _sorted(filtered)]


@router.put("/tasks/{task_id}", response_model=TaskRead)
def update_task(task_id: int, payload: TaskUpdate):
    task = repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    updates = payload.model_dump(exclude_none=True)
    if task.get("type") == TaskType.daily.value and task.get("is_done") and "date" in updates:
        old = task.get("date")
        new = updates["date"].isoformat() if hasattr(updates["date"], "isoformat") else str(updates["date"])
        if old != new:
            raise HTTPException(status_code=400, detail="Completed daily task cannot be carried over")

    updated = repo.update_task(task_id, updates) or task
    return TaskRead.model_validate(repo.to_task_read(updated))


@router.patch("/tasks/{task_id}/done", response_model=TaskRead)
def toggle_done(task_id: int):
    task = repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    is_done = not bool(task.get("is_done", False))
    status_value = "done" if is_done else "todo"
    updated = repo.update_task(task_id, {"is_done": is_done, "status": status_value}) or task
    return TaskRead.model_validate(repo.to_task_read(updated))


@router.post("/tasks/{task_id}/carry-over", response_model=TaskRead)
def carry_over_task(task_id: int):
    task = repo.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("type") != TaskType.daily.value or task.get("date") is None:
        raise HTTPException(status_code=400, detail="Carry-over is only for daily tasks")
    if task.get("is_done"):
        raise HTTPException(status_code=400, detail="Completed task cannot be carried over")

    next_date = date.fromisoformat(task["date"]) + timedelta(days=1)
    updated = repo.update_task(task_id, {"date": next_date, "carried_over": True, "is_done": False}) or task
    return TaskRead.model_validate(repo.to_task_read(updated))


@router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: int):
    if not repo.get_task(task_id):
        raise HTTPException(status_code=404, detail="Task not found")
    repo.delete_task(task_id)
