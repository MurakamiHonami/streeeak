import datetime as dt

from pydantic import BaseModel

from app.models.task import TaskType


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


class BreakdownTask(BaseModel):
    type: TaskType
    title: str
    month: int | None = None
    week_number: int | None = None
    date: dt.date | None = None
    note: str | None = None


class BreakdownResponse(BaseModel):
    source: str = "fallback"
    monthly: list[BreakdownTask]
    weekly: list[BreakdownTask]
    daily: list[BreakdownTask]
