from datetime import datetime, time

from sqlalchemy import DateTime, ForeignKey, LargeBinary, String, Time, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    avatar_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    avatar_content_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_premium: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    settings = relationship("UserSetting", back_populates="user", uselist=False)


class UserSetting(Base):
    __tablename__ = "user_settings"

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    auto_post_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    user = relationship("User", back_populates="settings")