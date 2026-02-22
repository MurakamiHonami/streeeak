import datetime as dt

from pydantic import BaseModel


class PostBase(BaseModel):
    user_id: int
    group_id: int | None = None
    date: dt.date
    comment: str
    achieved: float


class PostCreate(PostBase):
    pass


class PostUpdate(BaseModel):
    comment: str | None = None
    achieved: float | None = None
    group_id: int | None = None


class PostRead(PostBase):
    id: int
    week_number: int
    created_at: dt.datetime

    model_config = {"from_attributes": True}
