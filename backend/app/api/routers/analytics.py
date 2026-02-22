from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.friendship import Friendship
from app.models.post import Post
from app.models.user import User
from app.schemas.ranking import RankingItem

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/ranking", response_model=list[RankingItem])
def get_ranking(user_id: int, week: int, top_n: int = 3, db: Session = Depends(get_db)):
    friend_ids = list(db.scalars(select(Friendship.friend_id).where(Friendship.user_id == user_id)))
    target_ids = [user_id, *friend_ids]

    stmt = (
        select(Post.user_id, User.name, func.avg(Post.achieved).label("achieved_avg"))
        .join(User, User.id == Post.user_id)
        .where(Post.week_number == week, Post.user_id.in_(target_ids))
        .group_by(Post.user_id, User.name)
        .order_by(func.avg(Post.achieved).desc())
        .limit(top_n)
    )
    rows = db.execute(stmt).all()
    return [
        RankingItem(user_id=row.user_id, user_name=row.name, achieved_avg=float(row.achieved_avg))
        for row in rows
    ]
