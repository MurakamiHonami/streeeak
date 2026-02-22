from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.friendship import Friendship
from app.models.post import Post
from app.schemas.post import PostCreate, PostRead, PostUpdate

router = APIRouter(prefix="/posts", tags=["posts"])


@router.post("", response_model=PostRead, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostCreate, db: Session = Depends(get_db)):
    week_number = payload.date.isocalendar().week
    post = Post(**payload.model_dump(), week_number=week_number)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.get("", response_model=list[PostRead])
def list_posts(
    week: int,
    user_id: int | None = None,
    group_id: int | None = None,
    db: Session = Depends(get_db),
):
    stmt = select(Post).where(Post.week_number == week)
    if group_id is not None:
        stmt = stmt.where(Post.group_id == group_id)
    if user_id is not None:
        friend_ids = list(
            db.scalars(
                select(Friendship.friend_id).where(Friendship.user_id == user_id)
            )
        )
        visible_ids = [user_id, *friend_ids]
        stmt = stmt.where(Post.user_id.in_(visible_ids))
    return list(db.scalars(stmt.order_by(Post.created_at.desc())))


@router.put("/{post_id}", response_model=PostRead)
def update_post(post_id: int, payload: PostUpdate, db: Session = Depends(get_db)):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, db: Session = Depends(get_db)):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
