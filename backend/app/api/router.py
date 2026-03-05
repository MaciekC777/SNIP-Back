from fastapi import APIRouter

from app.api import auth, health, snipes

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(snipes.router)
api_router.include_router(health.router)
