import logging
import time as _time
import traceback
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from admin import router as admin_router
from auth import router as auth_router
from config import get_settings
from database import get_supabase
from feed import router as feed_router
from middleware import verify_token
from notifications import router as notifications_router
from plans import router as plans_router

settings = get_settings()
logger = logging.getLogger("hangowl")

ALLOWED_ORIGINS = [
    settings.frontend_url,
    "http://localhost:3000",
    "https://hangowl.com",
    "https://www.hangowl.com",
]

app = FastAPI(title="HangOwl API", version="1.0.0")

# GZip first so it wraps responses after CORS headers are set (~70% smaller JSON payloads)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


def _cors_headers_for(request: Request) -> dict[str, str]:
    """Return the CORS headers we would normally emit for this request's Origin.

    Starlette's ServerErrorMiddleware (added implicitly as the outermost wrapper)
    catches unhandled exceptions BEFORE CORSMiddleware runs, meaning the browser
    sees a 500 response with no Access-Control-Allow-Origin header and throws
    "TypeError: Failed to fetch" instead of surfacing the real error. Our
    exception handlers below use this to emit CORS headers manually so the
    client can actually read the error body.
    """
    origin = request.headers.get("origin", "")
    if origin in ALLOWED_ORIGINS:
        return {
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
            "Vary": "Origin",
        }
    return {}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc)
    logger.error(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=_cors_headers_for(request),
    )


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Defense-in-depth headers on every response.

    These are belt-and-braces — the API is API-only (no browser-rendered
    HTML) so the practical attack surface is small, but setting them
    costs us nothing and stops a category of mistakes if we ever
    accidentally return HTML.
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Permissions-Policy", "interest-cohort=()")
    return response

app.include_router(auth_router)
app.include_router(plans_router)
app.include_router(feed_router)
app.include_router(admin_router)
app.include_router(notifications_router)

# Module-level TTL caches. Persist across warm Vercel invocations on the same instance.
# tuple[data_dict, expires_monotonic_ts] | None
_stats_cache: tuple[dict, float] | None = None
_leaderboard_cache: tuple[dict, float] | None = None


@app.get("/")
async def root():
    return {"message": "HangOwl API", "status": "running"}


@app.get("/leaderboard")
async def leaderboard(response: Response):
    global _leaderboard_cache
    now = _time.monotonic()
    if _leaderboard_cache is not None and now < _leaderboard_cache[1]:
        response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
        return _leaderboard_cache[0]

    db = get_supabase()
    result = (
        db.table("users")
        .select("persona_name, hangout_count")
        .gt("hangout_count", 0)
        .order("hangout_count", desc=True)
        .limit(50)
        .execute()
    )
    data = {
        "leaderboard": [
            {"persona_name": u["persona_name"], "hangout_count": u["hangout_count"], "rank": i + 1}
            for i, u in enumerate(result.data)
        ]
    }
    _leaderboard_cache = (data, now + 300)  # 5-minute cache
    response.headers["Cache-Control"] = "public, max-age=300, stale-while-revalidate=60"
    return data


@app.get("/stats")
async def stats(response: Response):
    global _stats_cache
    now = _time.monotonic()
    if _stats_cache is not None and now < _stats_cache[1]:
        response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=10"
        return _stats_cache[0]

    db = get_supabase()
    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    active_users = (
        db.table("users").select("id", count="exact").gte("last_active_at", five_min_ago).execute()
    )
    total_users = db.table("users").select("id", count="exact").execute()
    now_iso = datetime.now(timezone.utc).isoformat()
    active_plans = (
        db.table("plans")
        .select("id")
        .eq("is_hidden", False)
        .gt("ends_at", now_iso)
        .execute()
    )
    data = {
        "free_now": active_users.count or 0,
        "active_plans": len(active_plans.data),
        "total_users": total_users.count or 0,
    }
    _stats_cache = (data, now + 30)  # 30-second cache
    response.headers["Cache-Control"] = "public, max-age=30, stale-while-revalidate=10"
    return data


@app.post("/heartbeat")
async def heartbeat(user: dict = Depends(verify_token)):
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    db.table("users").update({"last_active_at": now}).eq("id", user["sub"]).execute()
    return {"ok": True}
