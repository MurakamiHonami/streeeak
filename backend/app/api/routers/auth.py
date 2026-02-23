from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
import uuid

from app.db.session import get_db
from app.models.user import User, UserSetting
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest
from app.services.auth_service import create_access_token, hash_password, verify_password
from app.utils.mail import send_verification_email
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.scalar(select(User).where(User.email == payload.email))
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    v_token = str(uuid.uuid4())

    user = User(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        is_verified=False,
        verification_token=v_token
    )
    db.add(user)
    db.flush()
    db.add(UserSetting(user_id=user.id))
    db.commit()
    db.refresh(user)

    send_verification_email(user.email, v_token)

    if getattr(settings, "ENVIRONMENT", "local") == "local":
        user.is_verified = True
        db.commit()

    token = create_access_token(str(user.id))
    return AuthResponse(access_token=token, user_id=user.id)


@router.get("/verify")
def verify_email(token: str, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.verification_token == token))
    if not user:
        raise HTTPException(status_code=400, detail="無効なトークンです")
    
    user.is_verified = True
    user.verification_token = None
    db.commit()
    return {"message": "Email verified successfully"}


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email))
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.is_verified and getattr(settings, "ENVIRONMENT", "local") != "local":
        raise HTTPException(status_code=403, detail="Email not verified")

    token = create_access_token(str(user.id))
    return AuthResponse(access_token=token, user_id=user.id)


@router.post("/logout")
def logout():
    return {"message": "Logged out"}