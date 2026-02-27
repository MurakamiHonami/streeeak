import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from starlette.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.models import *

# パスの設定 (EC2の権限エラー回避)
BASE_DIR = Path(__file__).resolve().parent.parent
uploads_dir = BASE_DIR / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.APP_NAME)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    # テーブルの作成
    Base.metadata.create_all(bind=engine)
    
    # 自動カラム追加ロジック
    with engine.begin() as conn:
        inspector = inspect(conn)
        columns = {col["name"] for col in inspector.get_columns("users")}
        
        required_columns = [
            ("avatar_url", "VARCHAR(255)"),
            ("avatar_data", "BYTEA"),
            ("avatar_content_type", "VARCHAR(64)"),
            ("is_premium", "BOOLEAN DEFAULT FALSE"),
            ("is_verified", "BOOLEAN DEFAULT FALSE"),
            ("verification_token", "VARCHAR(255)"),
        ]
        
        for col_name, col_type in required_columns:
            if col_name not in columns:
                try:
                    conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                except Exception as e:
                    print(f"Error adding {col_name}: {e}")

@app.get("/health")
def health_check():
    return {"status": "ok"}

app.include_router(api_router)