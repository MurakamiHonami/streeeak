from fastapi import APIRouter

from app.api.routers import analytics, auth, friendships, goals, groups, posts, tasks, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(goals.router)
api_router.include_router(tasks.router)
api_router.include_router(posts.router)
api_router.include_router(friendships.router)
api_router.include_router(groups.router)
api_router.include_router(analytics.router)
