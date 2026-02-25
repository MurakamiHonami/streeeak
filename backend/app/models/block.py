from sqlalchemy import Column, Integer, ForeignKey
from app.db.base import Base

class Block(Base):
    __tablename__ = "blocks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    blocked_user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)