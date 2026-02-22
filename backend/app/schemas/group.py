from datetime import datetime

from pydantic import BaseModel


class GroupCreate(BaseModel):
    name: str
    owner_id: int | None = None


class GroupUpdate(BaseModel):
    name: str | None = None


class GroupRead(BaseModel):
    id: int
    name: str
    owner_id: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class GroupMemberCreate(BaseModel):
    user_id: int


class GroupMemberRead(BaseModel):
    id: int
    group_id: int
    user_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
