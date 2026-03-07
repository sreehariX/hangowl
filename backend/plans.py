from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_supabase
from middleware import verify_token

router = APIRouter(prefix="/plans", tags=["plans"])


class CreatePlanRequest(BaseModel):
    activity: str
    location: str
    description: str = ""
    max_people: int = 10
    plan_date: str
    starts_at: str
    ends_at: str


class SendMessageRequest(BaseModel):
    message: str


@router.get("")
async def get_plans(location: str | None = None, activity: str | None = None):
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    query = (
        db.table("plans")
        .select("*, plan_members(count), users!plans_creator_id_fkey(persona_name, hostel)")
        .eq("is_hidden", False)
        .gt("ends_at", now)
        .order("starts_at", desc=False)
    )

    if location:
        query = query.eq("location", location)
    if activity:
        query = query.eq("activity", activity)

    result = query.execute()
    return {"plans": result.data}


@router.get("/my")
async def get_my_plans(user: dict = Depends(verify_token)):
    db = get_supabase()
    user_id = user["sub"]

    memberships = (
        db.table("plan_members")
        .select("plan_id")
        .eq("user_id", user_id)
        .execute()
    )
    member_plan_ids = {m["plan_id"] for m in memberships.data}

    created_plans = (
        db.table("plans")
        .select("id")
        .eq("creator_id", user_id)
        .execute()
    )
    created_plan_ids = {p["id"] for p in created_plans.data}

    all_ids = list(member_plan_ids | created_plan_ids)

    if not all_ids:
        return {"live": [], "past": []}

    now = datetime.now(timezone.utc).isoformat()

    all_plans = (
        db.table("plans")
        .select("*, plan_members(count), users!plans_creator_id_fkey(persona_name, hostel)")
        .in_("id", all_ids)
        .eq("is_hidden", False)
        .order("starts_at", desc=True)
        .execute()
    )

    live = []
    past = []
    for p in all_plans.data:
        ends_at = p.get("ends_at") or ""
        if ends_at > now:
            live.append(p)
        else:
            past.append(p)

    return {"live": live, "past": past}


@router.get("/{plan_id}")
async def get_plan(plan_id: str):
    db = get_supabase()

    result = (
        db.table("plans")
        .select("*, plan_members(user_id, users(persona_name)), users!plans_creator_id_fkey(persona_name, hostel)")
        .eq("id", plan_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    return {"plan": result.data[0]}


@router.get("/{plan_id}/messages")
async def get_messages(plan_id: str):
    db = get_supabase()

    result = (
        db.table("plan_messages")
        .select("*, users(persona_name)")
        .eq("plan_id", plan_id)
        .order("created_at", desc=False)
        .limit(200)
        .execute()
    )

    return {"messages": result.data}


@router.post("/{plan_id}/messages")
async def send_message(plan_id: str, body: SendMessageRequest, user: dict = Depends(verify_token)):
    db = get_supabase()

    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(body.message) > 500:
        raise HTTPException(status_code=400, detail="Message too long (max 500 chars)")

    result = (
        db.table("plan_messages")
        .insert({
            "plan_id": plan_id,
            "user_id": user["sub"],
            "message": body.message.strip(),
        })
        .execute()
    )

    return {"message": result.data[0]}


@router.post("")
async def create_plan(body: CreatePlanRequest, user: dict = Depends(verify_token)):
    db = get_supabase()

    if not body.activity or len(body.activity) > 50:
        raise HTTPException(status_code=400, detail="Activity is required (max 50 chars)")

    if body.max_people < 2 or body.max_people > 50:
        raise HTTPException(status_code=400, detail="Max people must be between 2 and 50")

    result = (
        db.table("plans")
        .insert({
            "creator_id": user["sub"],
            "activity": body.activity,
            "location": body.location,
            "description": body.description,
            "max_people": body.max_people,
            "plan_date": body.plan_date,
            "starts_at": body.starts_at,
            "ends_at": body.ends_at,
            "expires_at": body.ends_at,
            "is_active": True,
            "is_hidden": False,
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


@router.delete("/{plan_id}")
async def hide_plan(plan_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()

    plan_result = (
        db.table("plans")
        .select("creator_id")
        .eq("id", plan_id)
        .execute()
    )

    if not plan_result.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    if plan_result.data[0]["creator_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the creator can delete this plan")

    db.table("plans").update({"is_hidden": True}).eq("id", plan_id).execute()

    return {"message": "Plan hidden"}


@router.post("/{plan_id}/join")
async def join_plan(plan_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()

    plan_result = (
        db.table("plans")
        .select("*, plan_members(count)")
        .eq("id", plan_id)
        .eq("is_hidden", False)
        .gt("ends_at", now)
        .execute()
    )

    if not plan_result.data:
        raise HTTPException(status_code=404, detail="Plan not found or ended")

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

    user_data = db.table("users").select("hangout_count").eq("id", user["sub"]).execute()
    current_count = user_data.data[0]["hangout_count"] if user_data.data else 0
    db.table("users").update({"hangout_count": current_count + 1}).eq("id", user["sub"]).execute()

    return {"message": "Joined plan successfully"}
