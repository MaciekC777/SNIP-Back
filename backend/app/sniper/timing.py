"""NTP-synced precise timing for snipe execution."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

import ntplib

logger = logging.getLogger(__name__)

NTP_SERVER = "pool.ntp.org"

# Offset between local clock and NTP time (seconds)
_ntp_offset: float = 0.0
_ntp_synced: bool = False


def ntp_time() -> float:
    """Return current time corrected by NTP offset."""
    return time.time() + _ntp_offset


def sync_ntp() -> None:
    """Synchronise local clock offset against NTP pool. Safe to call in a thread."""
    global _ntp_offset, _ntp_synced
    try:
        client = ntplib.NTPClient()
        response = client.request(NTP_SERVER, version=3)
        _ntp_offset = response.offset
        _ntp_synced = True
        logger.info("NTP synced: offset=%.3fms", _ntp_offset * 1000)
    except Exception as exc:
        logger.warning("NTP sync failed: %s — using local clock", exc)
        _ntp_synced = False


async def sync_ntp_async() -> None:
    """Run NTP sync in executor so it doesn't block the event loop."""
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, sync_ntp)


def get_ntp_offset_ms() -> Optional[float]:
    if not _ntp_synced:
        return None
    return _ntp_offset * 1000


def is_ntp_synced() -> bool:
    return _ntp_synced


async def precise_sleep(target_timestamp: float) -> None:
    """
    Sleep until target_timestamp (epoch seconds, NTP-corrected).

    Uses a coarse asyncio.sleep for most of the wait, then a tight spin-loop
    for the final 5ms to minimise OS scheduler jitter.
    """
    now = ntp_time()
    remaining = target_timestamp - now

    if remaining <= 0:
        return

    # Coarse sleep up to 5ms before target
    coarse = remaining - 0.005
    if coarse > 0:
        await asyncio.sleep(coarse)

    # Tight spin for last 5ms (CPU-heavy but precision-critical)
    while ntp_time() < target_timestamp:
        pass
