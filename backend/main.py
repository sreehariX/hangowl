from datetime import datetime, timedelta, timezone

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "http://localhost:3000",
        "https://hangowl.com",
        "https://www.hangowl.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(plans_router)
app.include_router(feed_router)
app.include_router(admin_router)
app.include_router(notifications_router)


@app.get("/")
async def root():
    return {"message": "HangOwl API", "status": "running"}


@app.get("/leaderboard")
async def leaderboard():
    db = get_supabase()

    result = (
        db.table("users")
        .select("persona_name, hangout_count")
        .gt("hangout_count", 0)
        .order("hangout_count", desc=True)
        .limit(50)
        .execute()
    )

    leaderboard_data = [
        {"persona_name": u["persona_name"], "hangout_count": u["hangout_count"], "rank": i + 1}
        for i, u in enumerate(result.data)
    ]

    return {"leaderboard": leaderboard_data}


@app.get("/stats")
async def stats():
    db = get_supabase()

    five_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
    active_users = db.table("users").select("id", count="exact").gte("last_active_at", five_min_ago).execute()

    total_users = db.table("users").select("id", count="exact").execute()

    now = datetime.now(timezone.utc).isoformat()
    active_plans = (
        db.table("plans")
        .select("id")
        .eq("is_hidden", False)
        .gt("ends_at", now)
        .execute()
    )

    return {
        "free_now": active_users.count or 0,
        "active_plans": len(active_plans.data),
        "total_users": total_users.count or 0,
    }


@app.post("/heartbeat")
async def heartbeat(user: dict = Depends(verify_token)):
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    db.table("users").update({"last_active_at": now}).eq("id", user["sub"]).execute()
    return {"ok": True}
