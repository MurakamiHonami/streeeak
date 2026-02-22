from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User, UserSetting
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=400, detail="Email already exists")
    user = User(email=payload.email, name=payload.name, password_hash=hash_password(payload.password))
    db.add(user)
    db.flush()
    settings = UserSetting(user_id=user.id)
    db.add(settings)
    db.commit()
    db.refresh(user)
    response = UserRead.model_validate(user)
    response.auto_post_time = settings.auto_post_time
    return response


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    settings = db.get(UserSetting, user_id)
    response = UserRead.model_validate(user)
    response.auto_post_time = settings.auto_post_time if settings else None
    return response


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.name is not None:
        user.name = payload.name

    settings = db.get(UserSetting, user_id)
    if not settings:
        settings = UserSetting(user_id=user.id)
        db.add(settings)
    if payload.auto_post_time is not None:
        settings.auto_post_time = payload.auto_post_time

    db.commit()
    db.refresh(user)
    response = UserRead.model_validate(user)
    response.auto_post_time = settings.auto_post_time
    return response


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
