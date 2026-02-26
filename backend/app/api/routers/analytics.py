from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.friendship import Friendship
from app.models.task import Task, TaskType
from app.models.user import User
from app.schemas.ranking import RankingItem

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/ranking", response_model=list[RankingItem])
def get_ranking(user_id: int, week: int, top_n: int = 3, db: Session = Depends(get_db)):
    friend_ids = list(db.scalars(select(Friendship.friend_id).where(Friendship.user_id == user_id)))
    target_ids = list(dict.fromkeys([user_id, *friend_ids]))
    users = list(db.scalars(select(User).where(User.id.in_(target_ids))))

    ranking_items: list[RankingItem] = []
    for user in users:
        total_stmt = select(func.count()).select_from(Task).where(
            Task.user_id == user.id,
            Task.type == TaskType.daily,
            Task.week_number == week,
        )
        done_stmt = select(func.count()).select_from(Task).where(
            Task.user_id == user.id,
            Task.type == TaskType.daily,
            Task.week_number == week,
            Task.is_done.is_(True),
        )
        total = db.scalar(total_stmt) or 0
        done = db.scalar(done_stmt) or 0
        achieved_rate = (done / total) if total > 0 else 0.0
        ranking_items.append(
            RankingItem(
                user_id=user.id,
                user_name=user.name,
                achieved_avg=float(achieved_rate),
                avatar_url=user.avatar_url,
            )
        )

    ranking_items.sort(key=lambda item: item.achieved_avg, reverse=True)
    return ranking_items[:top_n] if top_n > 0 else ranking_items
