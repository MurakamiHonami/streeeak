from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.friendship import Friendship
from app.models.post import Post, PostLike
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
            db.scalars(select(Friendship.friend_id).where(Friendship.user_id == user_id))
        )
        visible_ids = [user_id, *friend_ids]
        stmt = stmt.where(Post.user_id.in_(visible_ids))
        
    posts = list(db.scalars(stmt.order_by(Post.created_at.desc())))
    
    results = []
    for p in posts:
        pr = PostRead.model_validate(p)
        pr.user_name = p.user.name if p.user else None
        pr.user_avatar_url = p.user.avatar_url if p.user else None
        pr.likes_count = len(p.likes)
        pr.is_liked_by_you = any(like.user_id == user_id for like in p.likes) if user_id else False
        results.append(pr)
        
    return results

@router.post("/{post_id}/like", response_model=PostRead)
def toggle_like(post_id: int, user_id: int, db: Session = Depends(get_db)):
    post = db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    like = db.scalar(select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user_id))
    if like:
        db.delete(like)
    else:
        db.add(PostLike(post_id=post_id, user_id=user_id))
        
    db.commit()
    db.refresh(post)
    
    pr = PostRead.model_validate(post)
    pr.user_name = post.user.name if post.user else None
    pr.user_avatar_url = post.user.avatar_url if post.user else None
    pr.likes_count = len(post.likes)
    pr.is_liked_by_you = not bool(like)
    return pr

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