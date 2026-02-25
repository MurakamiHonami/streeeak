from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.user import User
from app.models.friendship import Friendship
from app.models.block import Block
from app.api.deps import get_current_user
from pydantic import BaseModel

router = APIRouter(prefix="/friendships", tags=["friendships"])

class FriendRequest(BaseModel):
    friend_id: int

class BlockRequest(BaseModel):
    target_user_id: int

@router.get("/search")
def search_user(email: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    
    block_exists = db.scalar(select(Block).where(
        or_(
            and_(Block.user_id == current_user.id, Block.blocked_user_id == user.id),
            and_(Block.user_id == user.id, Block.blocked_user_id == current_user.id)
        )
    ))
    if block_exists:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")

    return {"id": user.id, "name": user.name, "email": user.email}

@router.post("")
def add_friend(payload: FriendRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.friend_id == current_user.id:
        raise HTTPException(status_code=400, detail="自分自身を追加することはできません")

    is_blocked = db.scalar(select(Block).where(
        Block.user_id == payload.friend_id, Block.blocked_user_id == current_user.id
    ))
    if is_blocked:
        raise HTTPException(status_code=403, detail="このユーザーをフレンド追加できません")

    has_blocked = db.scalar(select(Block).where(
        Block.user_id == current_user.id, Block.blocked_user_id == payload.friend_id
    ))
    if has_blocked:
        raise HTTPException(status_code=400, detail="ブロック中のユーザーです。先にブロックを解除してください")

    new_friend = Friendship(user_id=current_user.id, friend_id=payload.friend_id)
    db.add(new_friend)
    db.commit()
    return {"status": "success", "message": "フレンドを追加しました"}

@router.get("")
def list_friends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):

    friends = db.query(User).join(Friendship, User.id == Friendship.friend_id).filter(Friendship.user_id == current_user.id).all()
    return friends


@router.post("/block")
def block_user(payload: BlockRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if payload.target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="自分自身をブロックすることはできません")

    db.query(Friendship).filter(
        or_(
            and_(Friendship.user_id == current_user.id, Friendship.friend_id == payload.target_user_id),
            and_(Friendship.user_id == payload.target_user_id, Friendship.friend_id == current_user.id)
        )
    ).delete(synchronize_session=False)


    existing_block = db.scalar(select(Block).where(
        Block.user_id == current_user.id, Block.blocked_user_id == payload.target_user_id
    ))
    if not existing_block:
        new_block = Block(user_id=current_user.id, blocked_user_id=payload.target_user_id)
        db.add(new_block)
        db.commit()

    return {"status": "success", "message": "ユーザーをブロックしました"}

@router.delete("/block/{target_user_id}")
def unblock_user(target_user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    block_record = db.scalar(select(Block).where(
        Block.user_id == current_user.id, Block.blocked_user_id == target_user_id
    ))
    if not block_record:
        raise HTTPException(status_code=404, detail="ブロック記録が見つかりません")
    
    db.delete(block_record)
    db.commit()
    return {"status": "success", "message": "ブロックを解除しました"}

@router.get("/blocks")
def list_blocked_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    blocked_users = db.query(User).join(Block, User.id == Block.blocked_user_id).filter(Block.user_id == current_user.id).all()
    return blocked_users