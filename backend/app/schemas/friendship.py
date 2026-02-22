from datetime import datetime

from pydantic import BaseModel


class FriendshipCreate(BaseModel):
    user_id: int
    friend_id: int


class FriendshipRead(BaseModel):
    id: int
    user_id: int
    friend_id: int
    created_at: datetime

    model_config = {"from_attributes": True}
