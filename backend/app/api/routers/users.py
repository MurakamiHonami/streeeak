import uuid
from pathlib import Path

import boto3
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import settings
from app.db import repositories as repo
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services.auth_service import hash_password

router = APIRouter(prefix="/users", tags=["users"])

@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate):
    if repo.get_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already exists")

    user = repo.create_user(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
    )
    user = repo.update_user(
        int(user["id"]),
        {"avatar_url": payload.avatar_url, "is_verified": True, "verification_token": None},
    ) or user
    user_settings = repo.get_user_settings(int(user["id"]))
    return UserRead.model_validate(repo.to_user_read(user, user_settings))


@router.get("/{user_id}/avatar")
def get_user_avatar(user_id: int):
    user = repo.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.get("avatar_url") and str(user["avatar_url"]).startswith("http"):
        return RedirectResponse(url=user["avatar_url"])
    raise HTTPException(status_code=404, detail="Avatar not found")


@router.get("/{user_id}", response_model=UserRead)
def get_user(user_id: int):
    user = repo.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    settings_item = repo.get_user_settings(user_id)
    return UserRead.model_validate(repo.to_user_read(user, settings_item))


@router.put("/{user_id}", response_model=UserRead)
def update_user(user_id: int, payload: UserUpdate):
    user = repo.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.avatar_url is not None:
        updates["avatar_url"] = payload.avatar_url

    if updates:
        user = repo.update_user(user_id, updates) or user

    settings_item = repo.get_user_settings(user_id)
    if payload.auto_post_time is not None:
        settings_item = repo.update_user_settings(user_id, payload.auto_post_time.isoformat())

    return UserRead.model_validate(repo.to_user_read(user, settings_item))


@router.post("/{user_id}/avatar", response_model=UserRead)
def upload_user_avatar(
    user_id: int,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if int(current_user["id"]) != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own avatar")

    user = repo.get_user(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    ext = Path(file.filename or "").suffix.lower() or ".png"
    if ext not in {".png", ".jpg", ".jpeg", ".gif", ".webp"}:
        raise HTTPException(status_code=400, detail="Unsupported image format")

    s3_client = boto3.client("s3", region_name=settings.AWS_REGION)
    file_key = f"avatars/{user_id}_{uuid.uuid4().hex}{ext}"

    try:
        s3_client.upload_fileobj(
            file.file,
            settings.S3_BUCKET_NAME,
            file_key,
            ExtraArgs={"ContentType": file.content_type},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to S3: {str(e)}")

    avatar_url = f"{settings.CDN_DOMAIN.rstrip('/')}/{file_key}"
    user = repo.update_user(user_id, {"avatar_url": avatar_url}) or user
    settings_item = repo.get_user_settings(user_id)
    return UserRead.model_validate(repo.to_user_read(user, settings_item))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int):
    if not repo.get_user(user_id):
        raise HTTPException(status_code=404, detail="User not found")
    repo.delete_user(user_id)


class VerifyPayload(BaseModel):
    username: str
    code: str


@router.post("/verify")
def verify_user(payload: VerifyPayload):
    return {
        "message": "Email verification is no longer required.",
        "username": payload.username,
    }
