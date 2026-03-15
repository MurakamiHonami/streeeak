from fastapi import APIRouter

from app.api.routers import analytics, auth, goals, tasks, users

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(goals.router)
api_router.include_router(tasks.router)
api_router.include_router(analytics.router)
