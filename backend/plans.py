from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from config import get_settings
from database import get_supabase
from middleware import verify_token

router = APIRouter(prefix="/plans", tags=["plans"])


class CreatePlanRequest(BaseModel):
    activity: str
    location: str
    description: str = ""
    max_people: int = 10


def deactivate_expired(db):
    cutoff = datetime.now(timezone.utc).isoformat()
    db.table("plans").update({"is_active": False}).lt("expires_at", cutoff).eq("is_active", True).execute()


@router.get("")
async def get_plans(hostel: str | None = None, activity: str | None = None):
    db = get_supabase()
    deactivate_expired(db)

    query = (
        db.table("plans")
        .select("*, plan_members(count), users!plans_creator_id_fkey(persona_name, hostel)")
        .eq("is_active", True)
        .gt("expires_at", datetime.now(timezone.utc).isoformat())
        .order("created_at", desc=True)
    )

    if hostel:
        query = query.eq("location", hostel)
    if activity:
        query = query.eq("activity", activity)

    result = query.execute()
    return {"plans": result.data}


@router.get("/{plan_id}")
async def get_plan(plan_id: str):
    db = get_supabase()
    deactivate_expired(db)

    result = (
        db.table("plans")
        .select("*, plan_members(user_id, users(persona_name)), users!plans_creator_id_fkey(persona_name, hostel)")
        .eq("id", plan_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    return {"plan": result.data[0]}


@router.post("")
async def create_plan(body: CreatePlanRequest, user: dict = Depends(verify_token)):
    settings = get_settings()
    db = get_supabase()

    if not body.activity or len(body.activity) > 50:
        raise HTTPException(status_code=400, detail="Activity is required (max 50 chars)")

    if body.max_people < 2 or body.max_people > 50:
        raise HTTPException(status_code=400, detail="Max people must be between 2 and 50")

    expires_at = (datetime.now(timezone.utc) + timedelta(hours=settings.plan_expiry_hours)).isoformat()

    result = (
        db.table("plans")
        .insert({
            "creator_id": user["sub"],
            "activity": body.activity,
            "location": body.location,
            "description": body.description,
            "max_people": body.max_people,
            "expires_at": expires_at,
            "is_active": True,
        })
        .execute()
    )

    plan = result.data[0]

    db.table("plan_members").insert({
        "plan_id": plan["id"],
        "user_id": user["sub"],
    }).execute()

    user_data = db.table("users").select("hangout_count").eq("id", user["sub"]).execute()
    current_count = user_data.data[0]["hangout_count"] if user_data.data else 0
    db.table("users").update({"hangout_count": current_count + 1}).eq("id", user["sub"]).execute()

    return {"plan": plan}


@router.post("/{plan_id}/join")
async def join_plan(plan_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()
    deactivate_expired(db)

    plan_result = (
        db.table("plans")
        .select("*, plan_members(count)")
        .eq("id", plan_id)
        .eq("is_active", True)
        .gt("expires_at", datetime.now(timezone.utc).isoformat())
        .execute()
    )

    if not plan_result.data:
        raise HTTPException(status_code=404, detail="Plan not found or expired")

    plan = plan_result.data[0]

    member_count = plan.get("plan_members", [{}])[0].get("count", 0) if plan.get("plan_members") else 0
    if member_count >= plan["max_people"]:
        raise HTTPException(status_code=400, detail="Plan is full")

    existing = (
        db.table("plan_members")
        .select("id")
        .eq("plan_id", plan_id)
        .eq("user_id", user["sub"])
        .execute()
    )

    if existing.data:
        raise HTTPException(status_code=400, detail="Already joined this plan")

    db.table("plan_members").insert({
        "plan_id": plan_id,
        "user_id": user["sub"],
    }).execute()

    return {"message": "Joined plan successfully"}
