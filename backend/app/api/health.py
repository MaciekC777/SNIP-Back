from fastapi import APIRouter

from app.config import settings
from app.models.schemas import HealthResponse
from app.sniper import scheduler, timing

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        environment=settings.environment,
        ntp_synced=timing.is_ntp_synced(),
        ntp_offset_ms=timing.get_ntp_offset_ms(),
        active_snipes=scheduler.active_snipe_count(),
        scheduler_running=scheduler.is_running(),
    )
