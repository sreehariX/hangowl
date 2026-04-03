import time as _time
from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from admin import router as admin_router
from auth import router as auth_router
from config import get_settings
from database import get_supabase
from feed import router as feed_router
from middleware import verify_token
from notifications import router as notifications_router
from plans import router as plans_router

settings = get_settings()

app = FastAPI(title="HangOwl API", version="1.0.0")

# GZip first so it wraps responses after CORS headers are set (~70% smaller JSON payloads)
app.add_middleware(GZipMiddleware, minimum_size=500)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "https://hangowl.com",
        "https://www.hangowl.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(auth_router)
app.include_router(plans_router)
app.include_router(feed_router)
app.include_router(admin_router)
app.include_router(notifications_router)

# Module-level TTL caches — persist across warm Vercel invocations on the same instance.
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
