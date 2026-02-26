from pydantic import BaseModel


class RankingItem(BaseModel):
    user_id: int
    user_name: str
    achieved_avg: float
    avatar_url: str | None = None
