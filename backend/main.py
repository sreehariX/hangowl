from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from auth import router as auth_router
from config import get_settings
from database import get_supabase
from plans import router as plans_router

settings = get_settings()

app = FastAPI(title="HangOwl API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(plans_router)


@app.get("/")
async def root():
    return {"message": "HangOwl API", "status": "running"}


@app.get("/leaderboard")
async def leaderboard():
    db = get_supabase()

    result = (
        db.table("users")
        .select("hostel, hangout_count")
        .neq("hostel", None)
        .execute()
    )

    hostel_scores: dict[str, int] = {}
    for user in result.data:
        h = user.get("hostel")
        if h:
            hostel_scores[h] = hostel_scores.get(h, 0) + user.get("hangout_count", 0)

    ranked = sorted(hostel_scores.items(), key=lambda x: x[1], reverse=True)
    leaderboard_data = [
        {"hostel": h, "total_hangouts": s, "rank": i + 1}
        for i, (h, s) in enumerate(ranked)
    ]

    top_persona_result = (
        db.table("users")
        .select("persona_name, hangout_count, hostel")
        .order("hangout_count", desc=True)
        .limit(1)
        .execute()
    )

    top_persona = top_persona_result.data[0] if top_persona_result.data else None

    return {
        "leaderboard": leaderboard_data,
        "most_spontaneous": top_persona,
    }


@app.get("/stats")
async def stats():
    db = get_supabase()

    now = datetime.now(timezone.utc).isoformat()
    active_plans = (
        db.table("plans")
        .select("id, plan_members(count)")
        .eq("is_active", True)
        .gt("expires_at", now)
        .execute()
    )

    total_free = 0
    for plan in active_plans.data:
        members = plan.get("plan_members", [])
        if members:
            total_free += members[0].get("count", 0)

    active_plan_count = len(active_plans.data)

    return {
        "free_now": total_free,
        "active_plans": active_plan_count,
    }
