from datetime import datetime, time

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    name: str
    avatar_url: str | None = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    name: str | None = None
    avatar_url: str | None = None
    auto_post_time: time | None = None


class UserRead(UserBase):
    id: int
    is_premium: bool
    created_at: datetime
    updated_at: datetime
    auto_post_time: time | None = None

    model_config = {"from_attributes": True}