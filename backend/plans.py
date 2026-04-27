from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from config import get_settings
from database import get_supabase
from middleware import verify_token
from rate_limit import RateLimit, enforce

router = APIRouter(prefix="/plans", tags=["plans"])

# Soft rate limits to keep individual users from spamming. These are roomy
# enough that the worst a real user will notice is a blocked accidental
# double-tap.
_PLAN_CREATE_PER_USER = RateLimit(limit=6, window_s=300)      # 6 / 5 min
_CHAT_SEND_PER_USER = RateLimit(limit=20, window_s=60)         # 20 / minute
_JOIN_PER_USER = RateLimit(limit=30, window_s=60)              # 30 joins/min


class CreatePlanRequest(BaseModel):
    activity: str
    location: str
    description: str = ""
    max_people: int = 10
    plan_date: str
    starts_at: str
    ends_at: str
    image_url: Optional[str] = None
    # Exact pin for Google Maps navigation. Mandatory as of v1.1 — the
    # text label ("H7") was too ambiguous for people arriving on
    # campus, so every plan now ships with a door-level pin. The fields
    # stay Optional at the schema level so we can surface a clearer
    # 400 error than Pydantic's default "field required" message.
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class SendMessageRequest(BaseModel):
    message: str


def _ensure_plan_member(db, plan_id: str, user_id: str) -> None:
    membership = (
        db.table("plan_members")
        .select("id")
        .eq("plan_id", plan_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if membership.data:
        return

    # Also allow the creator. Creators are normally inserted into
    # plan_members when the plan is created, but this keeps older rows or
    # data drift from breaking their chat access.
    creator = (
        db.table("plans")
        .select("creator_id")
        .eq("id", plan_id)
        .limit(1)
        .execute()
    )
    if creator.data and creator.data[0]["creator_id"] == user_id:
        return

    raise HTTPException(
        status_code=403,
        detail="Join this hangout before chatting in it.",
    )


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


@router.get("/my/ids")
async def get_my_plan_ids(user: dict = Depends(verify_token)):
    db = get_supabase()
    memberships = (
        db.table("plan_members")
        .select("plan_id")
        .eq("user_id", user["sub"])
        .execute()
    )
    return {"plan_ids": [m["plan_id"] for m in memberships.data]}


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

    message = body.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    if len(message) > 500:
        raise HTTPException(status_code=400, detail="Message too long (max 500 chars)")

    # Cap chat spam per user (20 messages/minute is well above polite chat
    # speed but stops obvious flooding).
    enforce("chat.send", _CHAT_SEND_PER_USER, identifier=user["sub"])

    # Only members of a plan should be able to post in its chat.
    _ensure_plan_member(db, plan_id, user["sub"])

    result = (
        db.table("plan_messages")
        .insert({
            "plan_id": plan_id,
            "user_id": user["sub"],
            "message": message,
        })
        .execute()
    )

    return {"message": result.data[0]}


@router.get("/{plan_id}/messages/unread-count")
async def get_unread_message_count(plan_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()
    user_id = user["sub"]
    _ensure_plan_member(db, plan_id, user_id)

    read = (
        db.table("plan_chat_reads")
        .select("last_read_at")
        .eq("plan_id", plan_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    last_read_at = read.data[0]["last_read_at"] if read.data else "1970-01-01T00:00:00+00:00"

    messages = (
        db.table("plan_messages")
        .select("id")
        .eq("plan_id", plan_id)
        .neq("user_id", user_id)
        .gt("created_at", last_read_at)
        .limit(100)
        .execute()
    )

    return {"count": min(len(messages.data), 99)}


@router.post("/{plan_id}/messages/read")
async def mark_messages_read(plan_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()
    user_id = user["sub"]
    _ensure_plan_member(db, plan_id, user_id)
    now = datetime.now(timezone.utc).isoformat()

    db.table("plan_chat_reads").upsert(
        {
            "plan_id": plan_id,
            "user_id": user_id,
            "last_read_at": now,
            "updated_at": now,
        },
        on_conflict="plan_id,user_id",
    ).execute()

    return {"ok": True}


@router.post("")
async def create_plan(body: CreatePlanRequest, user: dict = Depends(verify_token)):
    db = get_supabase()

    # Rate-limit plan creation per user: spammy plans clog everyone else's
    # feed, and the most likely "bug" that generates them is a client
    # double-submit. 6 plans / 5 minutes leaves headroom for genuine rapid
    # planning sprees.
    enforce("plan.create", _PLAN_CREATE_PER_USER, identifier=user["sub"])

    activity = (body.activity or "").strip()
    location = (body.location or "").strip()
    description = (body.description or "").strip()

    if not activity:
        raise HTTPException(status_code=400, detail="Activity is required")
    if len(activity) > 50:
        raise HTTPException(status_code=400, detail="Activity is too long (max 50 chars)")

    if not location:
        raise HTTPException(status_code=400, detail="Location is required")
    if len(location) > 80:
        raise HTTPException(status_code=400, detail="Location is too long (max 80 chars)")

    if len(description) > 500:
        raise HTTPException(status_code=400, detail="Description is too long (max 500 chars)")

    if body.max_people < 2 or body.max_people > 50:
        raise HTTPException(status_code=400, detail="Max people must be between 2 and 50")

    # Dates must be parseable AND form a sane interval. Without this a
    # client could POST ends_at < starts_at, or ends_at years from now.
    try:
        starts_dt = datetime.fromisoformat(body.starts_at.replace("Z", "+00:00"))
        ends_dt = datetime.fromisoformat(body.ends_at.replace("Z", "+00:00"))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    if ends_dt <= starts_dt:
        raise HTTPException(status_code=400, detail="End time must be after start time")

    now = datetime.now(timezone.utc)
    if ends_dt < now - timedelta(minutes=5):
        raise HTTPException(status_code=400, detail="Cannot create a plan in the past")
    if starts_dt > now + timedelta(days=90):
        raise HTTPException(status_code=400, detail="Plans can't start more than 90 days out")
    if (ends_dt - starts_dt) > timedelta(hours=24):
        raise HTTPException(status_code=400, detail="Plans can last at most 24 hours")

    insert_data = {
        "creator_id": user["sub"],
        "activity": activity,
        "location": location,
        "description": description,
        "max_people": body.max_people,
        "plan_date": body.plan_date,
        "starts_at": body.starts_at,
        "ends_at": body.ends_at,
        "expires_at": body.ends_at,
        "is_active": True,
        "is_hidden": False,
    }
    if body.image_url:
        # Mirror feed.create_post: only accept URLs that came from our own
        # uploader. Prevents arbitrary-link smuggling into the plan card.
        settings = get_settings()
        allowed_prefix = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/public/post-images/"
        )
        if not body.image_url.startswith(allowed_prefix):
            raise HTTPException(
                status_code=400,
                detail="Image URL must come from the HangOwl uploader",
            )
        insert_data["image_url"] = body.image_url

    # Every plan must ship with a door-level pin. The text label alone
    # ("H7", "Gymkhana") is too ambiguous for people arriving on
    # campus, and the whole point of the live map is to navigate
    # people to the right spot.
    if body.latitude is None or body.longitude is None:
        raise HTTPException(
            status_code=400,
            detail="Drop the exact pin on the map before creating the hangout.",
        )
    if not -90 <= body.latitude <= 90 or not -180 <= body.longitude <= 180:
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    insert_data["latitude"] = body.latitude
    insert_data["longitude"] = body.longitude

    result = (
        db.table("plans")
        .insert(insert_data)
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


def _do_record_plan_view(plan_id: str) -> None:
    db = get_supabase()
    plan = db.table("plans").select("views_count").eq("id", plan_id).execute()
    if plan.data:
        current = plan.data[0].get("views_count") or 0
        db.table("plans").update({"views_count": current + 1}).eq("id", plan_id).execute()


@router.post("/{plan_id}/view")
async def record_plan_view(plan_id: str, bg: BackgroundTasks):
    bg.add_task(_do_record_plan_view, plan_id)
    return {"ok": True}


@router.post("/{plan_id}/leave")
async def leave_plan(plan_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()

    plan_result = (
        db.table("plans")
        .select("creator_id")
        .eq("id", plan_id)
        .execute()
    )

    if not plan_result.data:
        raise HTTPException(status_code=404, detail="Plan not found")

    if plan_result.data[0]["creator_id"] == user["sub"]:
        raise HTTPException(status_code=400, detail="Creator cannot leave their own plan")

    existing = (
        db.table("plan_members")
        .select("id")
        .eq("plan_id", plan_id)
        .eq("user_id", user["sub"])
        .execute()
    )

    if not existing.data:
        raise HTTPException(status_code=400, detail="You are not in this plan")

    db.table("plan_members").delete().eq("plan_id", plan_id).eq("user_id", user["sub"]).execute()

    user_data = db.table("users").select("hangout_count").eq("id", user["sub"]).execute()
    current_count = user_data.data[0]["hangout_count"] if user_data.data else 0
    if current_count > 0:
        db.table("users").update({"hangout_count": current_count - 1}).eq("id", user["sub"]).execute()

    return {"message": "Left plan successfully"}


def _notify_plan_join(plan_id: str, actor_id: str, creator_id: str) -> None:
    db = get_supabase()
    actor_user = db.table("users").select("persona_name").eq("id", actor_id).execute()
    actor_persona = actor_user.data[0]["persona_name"] if actor_user.data else "Someone"
    db.table("notifications").insert({
        "user_id": creator_id,
        "type": "plan_join",
        "actor_id": actor_id,
        "actor_persona": actor_persona,
        "plan_id": plan_id,
    }).execute()


@router.post("/{plan_id}/join")
async def join_plan(plan_id: str, bg: BackgroundTasks, user: dict = Depends(verify_token)):
    # Cap how fast one user can fire join attempts: otherwise a script could
    # pump the creator's notification feed by join/leave thrashing.
    enforce("plan.join", _JOIN_PER_USER, identifier=user["sub"])

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

    creator_id = plan.get("creator_id")
    if creator_id and creator_id != user["sub"]:
        bg.add_task(_notify_plan_join, plan_id, user["sub"], creator_id)

    return {"message": "Joined plan successfully"}
