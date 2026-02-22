from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.friendship import Friendship
from app.schemas.friendship import FriendshipCreate, FriendshipRead

router = APIRouter(prefix="/friendships", tags=["friendships"])


@router.post("", response_model=FriendshipRead, status_code=status.HTTP_201_CREATED)
def create_friendship(payload: FriendshipCreate, db: Session = Depends(get_db)):
    if payload.user_id == payload.friend_id:
        raise HTTPException(status_code=400, detail="Cannot add yourself")

    existing = db.scalar(
        select(Friendship).where(
            or_(
                and_(
                    Friendship.user_id == payload.user_id,
                    Friendship.friend_id == payload.friend_id,
                ),
                and_(
                    Friendship.user_id == payload.friend_id,
                    Friendship.friend_id == payload.user_id,
                ),
            )
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Friendship already exists")

    friendship = Friendship(**payload.model_dump())
    reciprocal = Friendship(user_id=payload.friend_id, friend_id=payload.user_id)
    db.add_all([friendship, reciprocal])
    db.commit()
    db.refresh(friendship)
    return friendship


@router.get("", response_model=list[FriendshipRead])
def list_friendships(user_id: int, db: Session = Depends(get_db)):
    return list(db.scalars(select(Friendship).where(Friendship.user_id == user_id)))


@router.delete("/{friendship_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_friendship(friendship_id: int, db: Session = Depends(get_db)):
    friendship = db.get(Friendship, friendship_id)
    if not friendship:
        raise HTTPException(status_code=404, detail="Friendship not found")

    reciprocal = db.scalar(
        select(Friendship).where(
            Friendship.user_id == friendship.friend_id,
            Friendship.friend_id == friendship.user_id,
        )
    )
    db.delete(friendship)
    if reciprocal:
        db.delete(reciprocal)
    db.commit()
