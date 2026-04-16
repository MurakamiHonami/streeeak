from fastapi import APIRouter, HTTPException, status

from app.db import repositories as repo
from app.schemas.auth import LoginRequest, RegisterRequest, ResendVerificationRequest, VerifyRequest, AuthResponse
from app.services.auth_service import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest):
    existing = repo.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    user = repo.create_user(
        email=payload.email,
        name=payload.name.strip(),
        password_hash=hash_password(payload.password),
        verification_token=None,
    )
    user = repo.update_user(
        int(user["id"]),
        {"is_verified": True, "verification_token": None},
    ) or user

    access_token = create_access_token(str(user["id"]))
    return AuthResponse(access_token=access_token, user_id=int(user["id"]))


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    user = repo.get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.get("is_verified", False):
        user = repo.update_user(
            int(user["id"]),
            {"is_verified": True, "verification_token": None},
        ) or user

    access_token = create_access_token(str(user["id"]))
    return AuthResponse(access_token=access_token, user_id=int(user["id"]))


@router.post("/verify")
def verify_email(_: VerifyRequest):
    return {"message": "Email verification is no longer required."}


@router.post("/resend-verification")
def resend_verification(_: ResendVerificationRequest):
    return {"message": "Email verification is no longer required."}


@router.post("/logout")
def logout():
    return {"message": "Logged out"}
