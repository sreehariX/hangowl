"""
Tiny in-memory rate limiter.

Why in-memory and not Redis: on Vercel serverless each invocation may or may
not share state with neighbours, which would make a perfect sliding window
impossible without an external store. But a per-instance bucket still caps
abuse because every individual instance stops accepting new requests after
it's exhausted, and Vercel only scales out up to a fixed concurrency. At
campus-scale traffic (< a few thousand users) this is more than enough to
block the two realistic attacks:

    1. Someone hammering `/auth/send-otp` with a victim's email to spam
       their inbox and burn our Resend quota.
    2. Someone brute-forcing `/auth/verify-otp` hoping to hit one of 900k
       six-digit codes before the 10-minute TTL expires.

The limiter is intentionally minimal:
    - No dependencies (we already ship FastAPI; this file adds ~90 LOC).
    - Keys are plain strings; callers choose the namespace + identifier.
    - Each key holds a list of request timestamps within the window;
      requests past the limit are refused.
    - A light GC runs on every hit to keep the dict from growing
      unboundedly.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Deque, Dict, Optional, Tuple

from fastapi import HTTPException, Request


@dataclass(frozen=True)
class RateLimit:
    """How many events are allowed per window."""
    limit: int
    window_s: float


_buckets: Dict[str, Deque[float]] = defaultdict(deque)
_lock = threading.Lock()
# Keep GC cheap: only sweep every ~30s.
_last_gc: float = 0.0
_GC_INTERVAL_S: float = 30.0


def _sweep_locked(now: float) -> None:
    """Drop buckets that have been empty long enough to be pointless.
    Must be called while holding `_lock`."""
    stale: list[str] = []
    for key, dq in _buckets.items():
        # We don't know the window here, so use a generous 1-hour stale
        # threshold. Any legitimate rate window is way smaller.
        while dq and now - dq[0] > 3600:
            dq.popleft()
        if not dq:
            stale.append(key)
    for key in stale:
        _buckets.pop(key, None)


def _hit(key: str, rule: RateLimit) -> Tuple[bool, float]:
    """Record a hit. Returns (allowed, retry_after_seconds)."""
    global _last_gc
    now = time.monotonic()
    with _lock:
        dq = _buckets[key]
        # Trim events outside the current window.
        while dq and now - dq[0] > rule.window_s:
            dq.popleft()
        if len(dq) >= rule.limit:
            retry_after = max(0.0, rule.window_s - (now - dq[0]))
            return False, retry_after
        dq.append(now)
        if now - _last_gc > _GC_INTERVAL_S:
            _sweep_locked(now)
            _last_gc = now
        return True, 0.0


def client_ip(request: Request) -> str:
    """Best-effort client IP. Trusts the left-most X-Forwarded-For entry
    because Vercel/Fly/Render/etc. set it, then falls back to the direct
    peer. Always returns a non-empty string so bucket keys are stable."""
    fwd = request.headers.get("x-forwarded-for") or ""
    if fwd:
        return fwd.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def enforce(
    namespace: str,
    rule: RateLimit,
    *,
    request: Optional[Request] = None,
    identifier: Optional[str] = None,
) -> None:
    """Raise HTTPException(429) if the caller is over the limit.

    Callers should combine both axes that matter — e.g. both IP and email
    for OTP send — so neither single dimension can bypass the cap alone.
    Passing `request` uses the client IP; `identifier` is a freeform
    string (usually the email or user id). At least one of them must be
    supplied; keys that collapse to bare namespaces are rejected so we
    don't accidentally create a global single-bucket limiter.
    """
    if not request and not identifier:
        raise ValueError("enforce requires request or identifier")
    if request:
        key = f"{namespace}|ip:{client_ip(request)}"
        allowed, retry = _hit(key, rule)
        if not allowed:
            _raise_429(retry)
    if identifier:
        key = f"{namespace}|id:{identifier}"
        allowed, retry = _hit(key, rule)
        if not allowed:
            _raise_429(retry)


def _raise_429(retry_after_s: float) -> None:
    retry = max(1, int(round(retry_after_s)))
    raise HTTPException(
        status_code=429,
        detail="Too many requests. Try again in a moment.",
        headers={"Retry-After": str(retry)},
    )
