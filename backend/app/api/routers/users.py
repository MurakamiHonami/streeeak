import os
import uuid
from pathlib import Path

import boto3
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User, UserSetting
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import hash_password

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(status_code=400, detail="Email already exists")
    user = User(
        email=payload.email,
        name=payload.name,
        avatar_url=payload.avatar_url,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()
    settings = UserSetting(user_id=user.id)
    db.add(settings)
    db.commit()
    db.refresh(user)
    response = UserRead.model_validate(user)
    response.auto_post_time = settings.auto_post_time
    return response

@router.get("/{user_id}/avatar")
def get_user_avatar(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user or not user.avatar_data:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return Response(
        content=user.avatar_data,
        media_type=user.avatar_content_type or "image/png",
    )

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
    if payload.avatar_url is not None:
        user.avatar_url = payload.avatar_url

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

@router.post("/{user_id}/avatar", response_model=UserRead)
def upload_user_avatar(
    user_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own avatar")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    ext = Path(file.filename or "").suffix.lower() or ".png"
    allowed_exts = {".png", ".jpg", ".jpeg", ".gif", ".webp"}
    if ext not in allowed_exts:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    bucket_name = os.environ.get("S3_BUCKET_NAME", "streeeak-frontend-111")
    
    s3_client = boto3.client("s3")
    file_key = f"avatars/{user_id}_{uuid.uuid4().hex}{ext}"

    try:
        s3_client.upload_fileobj(
            file.file,
            bucket_name,
            file_key,
            ExtraArgs={"ContentType": file.content_type}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to S3: {str(e)}")


    s3_url = f"https://streeeak.link/{file_key}"

    user.avatar_data = None
    user.avatar_content_type = None
    user.avatar_url = s3_url
    db.commit()
    db.refresh(user)

    settings = db.get(UserSetting, user_id)
    response = UserRead.model_validate(user)
    response.auto_post_time = settings.auto_post_time if settings else None
    return response

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()