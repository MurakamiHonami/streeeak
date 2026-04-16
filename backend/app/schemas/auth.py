from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    name: str
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str | None = None
    token_type: str = "bearer"
    user_id: int
    message: str | None = None


class VerifyRequest(BaseModel):
    username: EmailStr | None = None
    email: EmailStr | None = None
    code: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr
