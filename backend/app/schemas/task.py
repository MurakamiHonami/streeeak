import datetime as dt
from pydantic import BaseModel
from typing import Literal

from app.models.task import TaskType, TaskPriority, TaskStatus

class TaskBase(BaseModel):
    goal_id: int | None = None
    user_id: int
    type: TaskType
    title: str
    month: int | None = None
    week_number: int | None = None
    date: dt.date | None = None
    tags: str | None = None
    note: str | None = None
    priority: TaskPriority | None = TaskPriority.mid
    status: TaskStatus | None = TaskStatus.todo

class TaskCreate(TaskBase):
    pass

class TaskBulkCreate(BaseModel):
    tasks: list[TaskCreate]

class TaskUpdate(BaseModel):
    title: str | None = None
    month: int | None = None
    week_number: int | None = None
    date: dt.date | None = None
    tags: str | None = None
    note: str | None = None
    is_done: bool | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None

class TaskRead(TaskBase):
    id: int
    is_done: bool
    carried_over: bool
    created_at: dt.datetime
    updated_at: dt.datetime

    model_config = {"from_attributes": True}


class BreakdownRequest(BaseModel):
    months: int = 12
    weeks_per_month: int = 4
    days_per_week: int = 7
    persist: bool = True
    current_situation: str | None = None

class BreakdownTask(BaseModel):
    type: TaskType
    title: str
    month: int | None = None
    week_number: int | None = None
    date: dt.date | None = None
    note: str | None = None
    priority: TaskPriority | None = TaskPriority.mid
    status: TaskStatus | None = TaskStatus.todo

class BreakdownResponse(BaseModel):
    source: str = "fallback"
    monthly: list[BreakdownTask]
    weekly: list[BreakdownTask]
    daily: list[BreakdownTask]

class DraftTask(BaseModel):
    task_id: int
    task_type: TaskType
    title: str
    note: str | None = None
    subtasks: list[str] = []
    status: TaskStatus | None = TaskStatus.todo
    priority: TaskPriority | None = TaskPriority.mid
    date: dt.date | None = None
    month: int | None = None
    week_number: int | None = None

class RevisionChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str

class RevisionChatRequest(BaseModel):
    message: str
    draft_tasks: list[DraftTask]
    chat_history: list[RevisionChatMessage] = []

class TaskRevisionProposal(BaseModel):
    proposal_id: str
    target_task_id: int
    target_type: Literal["monthly", "weekly", "daily", "subtask"]
    subtask_index: int | None = None
    before: str
    after: str
    reason: str

class RevisionChatResponse(BaseModel):
    source: str = "fallback"
    assistant_message: str
    proposals: list[TaskRevisionProposal]
    new_goal_title: str | None = None

class ApplyRevisionsRequest(BaseModel):
    accepted_proposals: list[TaskRevisionProposal]

class ApplyRevisionsResponse(BaseModel):
    updated_tasks: list[TaskRead]