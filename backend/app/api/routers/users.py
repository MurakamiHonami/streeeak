import os
import uuid
from pathlib import Path

import boto3
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User, UserSetting
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import hash_password
from app.core.config import settings

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
    user_settings = UserSetting(user_id=user.id)
    db.add(user_settings)
    db.commit()
    db.refresh(user)
    response = UserRead.model_validate(user)
    response.auto_post_time = user_settings.auto_post_time
    return response

@router.get("/{user_id}/avatar")
def get_user_avatar(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # DBにS3のURLがあれば、そのURLにリダイレクトさせる
    if user.avatar_url and user.avatar_url.startswith("http"):
        return RedirectResponse(url=user.avatar_url)

    if not user.avatar_data:
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
    user_settings = db.get(UserSetting, user_id)
    response = UserRead.model_validate(user)
    response.auto_post_time = user_settings.auto_post_time if user_settings else None
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

    user_settings = db.get(UserSetting, user_id)
    if not user_settings:
        user_settings = UserSetting(user_id=user.id)
        db.add(user_settings)
    if payload.auto_post_time is not None:
        user_settings.auto_post_time = payload.auto_post_time

    db.commit()
    db.refresh(user)
    response = UserRead.model_validate(user)
    response.auto_post_time = user_settings.auto_post_time
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

    bucket_name = getattr(settings, "S3_BUCKET_NAME", "streeeak-frontend-111")
    cdn_domain = getattr(settings, "CDN_DOMAIN", "https://streeeak.link")
    region = getattr(settings, "AWS_REGION", "ap-northeast-1")
    
    # 💡 ローカルと本番（EC2）両対応の Boto3 クライアント作成
    aws_access_key = getattr(settings, "AWS_ACCESS_KEY_ID", None)
    aws_secret_key = getattr(settings, "AWS_SECRET_ACCESS_KEY", None)

    if aws_access_key and aws_secret_key:
        # ローカルの場合は .env の鍵を使う
        s3_client = boto3.client(
            "s3", 
            region_name=region,
            aws_access_key_id=aws_access_key,
            aws_secret_access_key=aws_secret_key
        )
    else:
        # EC2の場合はIAMロールを自動で使う
        s3_client = boto3.client("s3", region_name=region)

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

    s3_url = f"{cdn_domain.rstrip('/')}/{file_key}"

    user.avatar_data = None
    user.avatar_content_type = None
    user.avatar_url = s3_url
    db.commit()
    db.refresh(user)

    user_settings = db.get(UserSetting, user_id)
    response = UserRead.model_validate(user)
    response.auto_post_time = user_settings.auto_post_time if user_settings else None
    return response

@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()