from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.friendship import Friendship
from app.api.deps import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/friendships", tags=["friendships"])

class FriendRequest(BaseModel):
    friend_id: int

@router.get("/search")
def search_user(email: str, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    return {"id": user.id, "name": user.name, "email": user.email}

@router.post("")
def add_friend(payload: FriendRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="自分自身を追加することはできません")
    new_friend = Friendship(user_id=current_user.id, friend_id=payload.friend_id)
    db.add(new_friend)
    db.commit()
    return {"status": "success", "message": "フレンドを追加しました"}
@router.get("")
def list_friends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    friends = db.query(User).join(Friendship, User.id == Friendship.friend_id).filter(Friendship.user_id == current_user.id).all()
    return friends