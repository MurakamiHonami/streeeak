import uuid
import zlib
import base64
import hashlib
import hmac

import boto3
from botocore.exceptions import ClientError
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.db import repositories as repo
from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    ResendVerificationRequest,
    VerifyRequest,
)
from app.services.auth_service import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
cognito_client = boto3.client("cognito-idp", region_name=settings.AWS_REGION)

def _local_user_id(email: str) -> int:
    return (zlib.crc32(email.encode("utf-8")) % 900000000) + 1000

def _secret_hash(username: str) -> str | None:
    secret = settings.COGNITO_CLIENT_SECRET
    if not secret:
        return None
    digest = hmac.new(
        secret.encode("utf-8"),
        (username + settings.COGNITO_CLIENT_ID).encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return base64.b64encode(digest).decode("utf-8")

def _with_secret_hash(username: str, params: dict) -> dict:
    secret_hash = _secret_hash(username)
    if secret_hash:
        params["SecretHash"] = secret_hash
    return params


def _resend_confirmation_code(email: str) -> tuple[bool, str]:
    try:
        resend_req = _with_secret_hash(
            email,
            {
                "ClientId": settings.COGNITO_CLIENT_ID,
                "Username": email,
            },
        )
        cognito_client.resend_confirmation_code(**resend_req)
        return True, "Verification code was re-sent."
    except ClientError as e:
        return False, e.response.get("Error", {}).get("Message", "Unknown error")


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest):
    if settings.ENVIRONMENT == "local":
        local_id = _local_user_id(payload.email)
        access_token = create_access_token(str(local_id))
        return AuthResponse(access_token=access_token, user_id=local_id)

    existing = repo.get_user_by_email(payload.email)
    if existing:
        ok, message = _resend_confirmation_code(payload.email)
        if ok:
            return AuthResponse(
                user_id=int(existing["id"]),
                requires_verification=True,
                message="Verification code was re-sent.",
            )
        if message.startswith("User is already confirmed"):
            raise HTTPException(status_code=400, detail="Email already exists and is already confirmed. Please login.")
        raise HTTPException(status_code=400, detail=f"Existing user but resend failed: {message}")

    try:
        sign_up_req = _with_secret_hash(
            payload.email,
            {
                "ClientId": settings.COGNITO_CLIENT_ID,
                "Username": payload.email,
                "Password": payload.password,
                "UserAttributes": [
                    {"Name": "email", "Value": payload.email},
                    {"Name": "name", "Value": payload.name},
                ],
            },
        )
        cognito_client.sign_up(**sign_up_req)
    except cognito_client.exceptions.UsernameExistsException:
        # Existing-but-unverified users are common in Cognito flows. Re-send code.
        ok, message = _resend_confirmation_code(payload.email)
        if ok:
            existing_user = repo.get_user_by_email(payload.email)
            return AuthResponse(
                user_id=int(existing_user["id"]) if existing_user else 0,
                requires_verification=True,
                message="Account already exists. A new verification code was sent.",
            )
        raise HTTPException(status_code=400, detail=message)
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
    email = payload.email or payload.username
    if not email:
        raise HTTPException(status_code=422, detail="email or username is required")

    if settings.ENVIRONMENT == "local":
        user = repo.get_user_by_email(email)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        repo.update_user(int(user["id"]), {"is_verified": True, "verification_token": None})
        return {"message": "Local mode: verification bypassed"}

    try:
        confirm_req = _with_secret_hash(
            email,
            {
                "ClientId": settings.COGNITO_CLIENT_ID,
                "Username": email,
                "ConfirmationCode": payload.code,
            },
        )
        cognito_client.confirm_sign_up(**confirm_req)
    except ClientError as e:
        raise HTTPException(status_code=400, detail=e.response["Error"]["Message"])

    user = repo.get_user_by_email(email)
    if user:
        repo.update_user(int(user["id"]), {"is_verified": True, "verification_token": None})
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
def resend_verification(payload: ResendVerificationRequest):
    if settings.ENVIRONMENT == "local":
        return {"message": "Local mode: resend bypassed"}

    ok, message = _resend_confirmation_code(payload.email)
    if ok:
        return {"message": "Verification code re-sent"}
    raise HTTPException(status_code=400, detail=message)


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest):
    if settings.ENVIRONMENT == "local":
        local_id = _local_user_id(payload.email)
        access_token = create_access_token(str(local_id))
        return AuthResponse(access_token=access_token, user_id=local_id)

    try:
        auth_params = {
                "USERNAME": payload.email,
                "PASSWORD": payload.password,
        }
        secret_hash = _secret_hash(payload.email)
        if secret_hash:
            auth_params["SECRET_HASH"] = secret_hash

        cognito_client.initiate_auth(
            ClientId=settings.COGNITO_CLIENT_ID,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters=auth_params,
        )
    except cognito_client.exceptions.UserNotConfirmedException:
        # If app-side verification is already complete, allow login with local password hash
        # to avoid a resend loop when Cognito state is temporarily inconsistent.
        user = repo.get_user_by_email(payload.email)
        if user and user.get("is_verified") and verify_password(payload.password, user.get("password_hash", "")):
            access_token = create_access_token(str(user["id"]))
            return AuthResponse(access_token=access_token, user_id=int(user["id"]))

        ok, message = _resend_confirmation_code(payload.email)
        if ok:
            raise HTTPException(status_code=403, detail="Email not verified. Verification code was re-sent.")
        raise HTTPException(status_code=403, detail=f"Email not verified. Resend failed: {message}")
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
