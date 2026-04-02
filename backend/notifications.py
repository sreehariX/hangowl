from fastapi import APIRouter, Depends

from database import get_supabase
from middleware import verify_token

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
async def get_notifications(user: dict = Depends(verify_token)):
    db = get_supabase()
    result = (
        db.table("notifications")
        .select("*, posts(content), plans(activity, location)")
        .eq("user_id", user["sub"])
        .order("created_at", desc=True)
        .limit(60)
        .execute()
    )
    return {"notifications": result.data}


@router.get("/unread-count")
async def get_unread_count(user: dict = Depends(verify_token)):
    db = get_supabase()
    result = (
        db.table("notifications")
        .select("id", count="exact")
        .eq("user_id", user["sub"])
        .eq("is_read", False)
        .execute()
    )
    return {"count": result.count or 0}


@router.post("/read-all")
async def mark_all_read(user: dict = Depends(verify_token)):
    db = get_supabase()
    db.table("notifications").update({"is_read": True}).eq("user_id", user["sub"]).eq("is_read", False).execute()
    return {"ok": True}


@router.post("/{notification_id}/read")
async def mark_read(notification_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()
    db.table("notifications").update({"is_read": True}).eq("id", notification_id).eq("user_id", user["sub"]).execute()
    return {"ok": True}
