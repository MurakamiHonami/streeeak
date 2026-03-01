from datetime import date, datetime

from pydantic import BaseModel


class GoalBase(BaseModel):
    title: str
    deadline: date | None = None
    current_situation: str | None = None


class GoalCreate(GoalBase):
    user_id: int


class GoalUpdate(BaseModel):
    title: str | None = None
    deadline: date | None = None
    current_situation: str | None = None


class GoalRead(GoalBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
