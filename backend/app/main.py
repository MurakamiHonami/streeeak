from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.api.router import api_router
from app.core.config import settings

BASE_DIR = Path(__file__).resolve().parent.parent
uploads_dir = BASE_DIR / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.APP_NAME)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

allowed_origins = [
    "https://streeeak.link",
    "https://www.streeeak.link",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.streeeak\.link",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok"}


app.include_router(api_router)
