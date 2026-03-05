"""SniperEngine — executes a single snipe with multi-bid fallback strategy."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.config import settings
from app.models.schemas import SnipeStatus
from app.services import allegro_client, supabase_client, token_manager
from app.sniper import timing

logger = logging.getLogger(__name__)

# Bid schedule relative to offer end (seconds before end → fire bid)
# Sends 3 bids: 300ms, 200ms, 100ms (or SNIPE_OFFSET_MS) before end
_BID_OFFSETS_S: list[float] = [0.3, 0.2, 0.1]


class SniperEngine:
    """Executes a snipe for a given snipe record."""

    async def execute_snipe(self, snipe: dict[str, Any]) -> None:
        snipe_id = snipe["id"]
        offer_id = snipe["allegro_offer_id"]
        max_amount = float(snipe["max_bid_amount"])
        user = snipe.get("users") or {}

        logger.info("[snipe:%s] Starting execution for offer %s", snipe_id, offer_id)
        await supabase_client.log_action(snipe_id, "executing", f"offer_id={offer_id}")
        await supabase_client.update_snipe_status(snipe_id, SnipeStatus.executing)

        # 1. Decrypt access token
        try:
            access_token = token_manager.decrypt_token(user["encrypted_access_token"])
            refresh_tok = token_manager.decrypt_token(user["encrypted_refresh_token"])
        except Exception as exc:
            await self._fail(snipe_id, f"Token decryption failed: {exc}")
            return

        # 2. Refresh token if needed (proactive refresh)
        expires_at_str = user.get("token_expires_at")
        if expires_at_str:
            try:
                expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                now_utc = datetime.now(timezone.utc)
                if (expires_at - now_utc).total_seconds() < 300:
                    access_token, refresh_tok = await self._refresh_and_save(
                        user["id"], refresh_tok
                    )
            except Exception as exc:
                logger.warning("[snipe:%s] Token refresh check failed: %s", snipe_id, exc)

        # 3. Fetch current offer state
        try:
            offer = await allegro_client.get_offer(offer_id)
        except allegro_client.AllegroNotFoundError:
            await self._fail(snipe_id, "Offer not found on Allegro")
            return
        except Exception as exc:
            await self._fail(snipe_id, f"Failed to fetch offer: {exc}")
            return

        end_time_str = offer.get("endingAt") or offer.get("endTime")
        if not end_time_str:
            await self._fail(snipe_id, "Could not determine offer end time")
            return

        end_time = datetime.fromisoformat(end_time_str.replace("Z", "+00:00")).timestamp()
        now = timing.ntp_time()

        if end_time <= now:
            await self._fail(snipe_id, "Offer already ended before snipe execution")
            return

        # 4. Fire bids at calculated offsets
        offset_s = settings.snipe_offset_ms / 1000.0
        bid_times = [end_time - offset_s for offset_s in _BID_OFFSETS_S]
        # Override last bid with configured offset
        bid_times[-1] = end_time - offset_s

        last_result: dict | None = None
        for i, bid_target in enumerate(sorted(bid_times)):
            await supabase_client.log_action(
                snipe_id, "bid_scheduled", f"bid#{i+1} target={bid_target}"
            )
            await timing.precise_sleep(bid_target)

            try:
                result = await allegro_client.place_bid(offer_id, max_amount, access_token)
                last_result = result
                await supabase_client.log_action(
                    snipe_id, "bid_placed", f"bid#{i+1} result={result}"
                )
                logger.info("[snipe:%s] Bid #%d placed: %s", snipe_id, i + 1, result)
            except allegro_client.AllegroUnauthorizedError:
                try:
                    access_token, refresh_tok = await self._refresh_and_save(
                        user["id"], refresh_tok
                    )
                    result = await allegro_client.place_bid(offer_id, max_amount, access_token)
                    last_result = result
                    await supabase_client.log_action(
                        snipe_id, "bid_placed_after_refresh", f"bid#{i+1} result={result}"
                    )
                except Exception as exc:
                    await supabase_client.log_action(
                        snipe_id, "bid_failed", f"bid#{i+1} error={exc}"
                    )
            except Exception as exc:
                await supabase_client.log_action(
                    snipe_id, "bid_failed", f"bid#{i+1} error={exc}"
                )
                logger.warning("[snipe:%s] Bid #%d failed: %s", snipe_id, i + 1, exc)

        # 5. Determine final status
        executed_at = datetime.now(timezone.utc).isoformat()
        if last_result:
            won = self._check_win(last_result)
            final_status = SnipeStatus.won if won else SnipeStatus.lost
            msg = f"Final bid result: {last_result}"
            current_price = self._extract_price(last_result)
        else:
            final_status = SnipeStatus.error
            msg = "All bid attempts failed"
            current_price = None

        await supabase_client.update_snipe_status(
            snipe_id, final_status, msg,
            current_price=current_price,
            executed_at=executed_at,
        )
        await supabase_client.log_action(snipe_id, "finished", msg)
        logger.info("[snipe:%s] Finished with status=%s", snipe_id, final_status)

    # ---------- Helpers ----------

    async def _refresh_and_save(self, user_id: str, refresh_tok: str) -> tuple[str, str]:
        token_data = await allegro_client.refresh_token(refresh_tok)
        new_access = token_data["access_token"]
        new_refresh = token_data["refresh_token"]
        expires_in = int(token_data.get("expires_in", 3600))

        from datetime import timedelta
        expires_at = (
            datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        ).isoformat()

        await supabase_client.update_user_tokens(
            user_id,
            token_manager.encrypt_token(new_access),
            token_manager.encrypt_token(new_refresh),
            expires_at,
        )
        return new_access, new_refresh

    async def _fail(self, snipe_id: str, reason: str) -> None:
        logger.error("[snipe:%s] Failed: %s", snipe_id, reason)
        await supabase_client.update_snipe_status(snipe_id, SnipeStatus.error, reason)
        await supabase_client.log_action(snipe_id, "error", reason)

    @staticmethod
    def _check_win(result: dict) -> bool:
        """
        Determine win from Allegro bid response.
        Allegro returns the highest bid status; adjust to actual response shape.
        """
        return result.get("winningBid", {}).get("winner") is True or "id" in result

    @staticmethod
    def _extract_price(result: dict) -> float | None:
        """Extract current price from Allegro bid response."""
        try:
            price = (
                result.get("price", {}).get("amount")
                or result.get("currentPrice", {}).get("amount")
                or result.get("winningBid", {}).get("price", {}).get("amount")
            )
            return float(price) if price is not None else None
        except (TypeError, ValueError):
            return None
