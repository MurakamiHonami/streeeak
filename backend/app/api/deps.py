from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.db import repositories as repo

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

def get_current_user(
    token: str = Depends(oauth2_scheme)
) -> dict:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication credentials",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        subject = payload.get("sub")
        user_id = int(subject) if subject is not None else None
    except (JWTError, ValueError, TypeError):
        raise unauthorized

    if not user_id:
        raise unauthorized

    if settings.ENVIRONMENT == "local":
        return {"id": user_id, "email": f"local-{user_id}@example.local", "name": "Local User"}

    user = repo.get_user(user_id)
    if not user:
        raise unauthorized
    return user
