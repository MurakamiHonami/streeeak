from fastapi import APIRouter

from app.db import repositories as repo
from app.schemas.ranking import RankingItem

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/ranking", response_model=list[RankingItem])
def get_ranking(user_id: int, week: int, top_n: int = 3):
    tasks = repo.list_tasks_by_user(user_id)
    daily = [t for t in tasks if t.get("type") == "daily" and int(t.get("week_number") or -1) == week]
    total = len(daily)
    done = len([t for t in daily if bool(t.get("is_done"))])
    achieved = float(done / total) if total > 0 else 0.0
    return [
        RankingItem(
            user_id=user_id,
            user_name=f"User {user_id}",
            achieved_avg=achieved,
            avatar_url=None,
        )
    ][: max(1, top_n)]
