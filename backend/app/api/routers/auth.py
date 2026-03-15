import uuid
import zlib

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.db import repositories as repo
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, VerifyRequest
from app.services.auth_service import create_access_token, hash_password

router = APIRouter(prefix="/auth", tags=["auth"])
cognito_client = boto3.client("cognito-idp", region_name=settings.AWS_REGION)

def _local_user_id(email: str) -> int:
    return (zlib.crc32(email.encode("utf-8")) % 900000000) + 1000


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest):
    if settings.ENVIRONMENT == "local":
        local_id = _local_user_id(payload.email)
        access_token = create_access_token(str(local_id))
        return AuthResponse(access_token=access_token, user_id=local_id)

    existing = repo.get_user_by_email(payload.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    try:
        cognito_client.sign_up(
            ClientId=settings.COGNITO_CLIENT_ID,
            Username=payload.email,
            Password=payload.password,
            UserAttributes=[
                {"Name": "email", "Value": payload.email},
                {"Name": "name", "Value": payload.name},
            ],
        )
    except cognito_client.exceptions.UsernameExistsException:
        # Existing-but-unverified users are common in Cognito flows.
        # Try re-sending the confirmation code instead of hard-failing registration UX.
        try:
            cognito_client.resend_confirmation_code(
                ClientId=settings.COGNITO_CLIENT_ID,
                Username=payload.email,
            )
            return AuthResponse(
                user_id=0,
                requires_verification=True,
                message="Account already exists. A new verification code was sent.",
            )
        except ClientError as e:
            raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])

    user = repo.create_user(
        email=payload.email,
        name=payload.name,
        password_hash=hash_password(payload.password),
        verification_token=None,
    )

    return AuthResponse(
        user_id=int(user["id"]),
        requires_verification=True,
        message="Verification code was sent to your email.",
    )


@router.post("/verify")
def verify_email(payload: VerifyRequest):
    if settings.ENVIRONMENT == "local":
        user = repo.get_user_by_email(payload.username)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        repo.update_user(int(user["id"]), {"is_verified": True, "verification_token": None})
        return {"message": "Local mode: verification bypassed"}

    try:
        cognito_client.confirm_sign_up(
            ClientId=settings.COGNITO_CLIENT_ID,
            Username=payload.username,
            ConfirmationCode=payload.code,
        )
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])

    user = repo.get_user_by_email(payload.username)
    if user:
        repo.update_user(int(user["id"]), {"is_verified": True, "verification_token": None})
    return {"message": "Email verified successfully"}


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    if settings.ENVIRONMENT == "local":
        local_id = _local_user_id(payload.email)
        access_token = create_access_token(str(local_id))
        return AuthResponse(access_token=access_token, user_id=local_id)

    try:
        cognito_client.initiate_auth(
            ClientId=settings.COGNITO_CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": payload.email,
                "PASSWORD": payload.password,
            },
        )
    except cognito_client.exceptions.UserNotConfirmedException:
        raise HTTPException(status_code=403, detail="Email not verified")
    except cognito_client.exceptions.NotAuthorizedException:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])

    user = repo.get_user_by_email(payload.email)
    if not user:
        # Recover from past inconsistent states where Cognito user exists but app DB user is missing.
        auto_name = payload.email.split("@")[0] if "@" in payload.email else payload.email
        user = repo.create_user(
            email=payload.email,
            name=auto_name or "user",
            password_hash=hash_password(payload.password),
            verification_token=None,
        )
        user = repo.update_user(int(user["id"]), {"is_verified": True}) or user

    if not user.get("is_verified", False):
        repo.update_user(int(user["id"]), {"is_verified": True, "verification_token": None})
        user = repo.get_user(int(user["id"])) or user

    access_token = create_access_token(str(user["id"]))
    return AuthResponse(access_token=access_token, user_id=int(user["id"]))


@router.post("/logout")
def logout():
    return {"message": "Logged out"}
