from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from database import get_supabase
from middleware import verify_admin

router = APIRouter(prefix="/admin", tags=["admin"])


class BanUserRequest(BaseModel):
    user_id: str
    ban_type: str  # 1_week, 1_month, permanent
    reason: Optional[str] = None


@router.post("/ban")
async def ban_user(body: BanUserRequest, admin: dict = Depends(verify_admin)):
    if body.ban_type not in ("1_week", "1_month", "permanent"):
        raise HTTPException(status_code=400, detail="Invalid ban type")

    db = get_supabase()

    target = db.table("users").select("id, is_admin").eq("id", body.user_id).execute()
    if not target.data:
        raise HTTPException(status_code=404, detail="User not found")
    if target.data[0].get("is_admin"):
        raise HTTPException(status_code=400, detail="Cannot ban an admin")

    now = datetime.now(timezone.utc)
    banned_until = None
    if body.ban_type == "1_week":
        banned_until = (now + timedelta(weeks=1)).isoformat()
    elif body.ban_type == "1_month":
        banned_until = (now + timedelta(days=30)).isoformat()

    db.table("user_bans").insert({
        "user_id": body.user_id,
        "banned_by": admin["sub"],
        "ban_type": body.ban_type,
        "reason": body.reason,
        "banned_until": banned_until,
    }).execute()

    return {"message": f"User banned ({body.ban_type})"}


@router.post("/unban/{user_id}")
async def unban_user(user_id: str, admin: dict = Depends(verify_admin)):
    db = get_supabase()
    db.table("user_bans").delete().eq("user_id", user_id).execute()
    return {"message": "User unbanned"}


@router.delete("/posts/{post_id}")
async def admin_delete_post(post_id: str, admin: dict = Depends(verify_admin)):
    db = get_supabase()

    post = db.table("posts").select("id, parent_id").eq("id", post_id).execute()
    if not post.data:
        raise HTTPException(status_code=404, detail="Post not found")

    db.table("posts").update({"is_hidden": True}).eq("id", post_id).execute()

    parent_id = post.data[0].get("parent_id")
    if parent_id:
        parent_result = db.table("posts").select("replies_count").eq("id", parent_id).execute()
        if parent_result.data:
            current_count = parent_result.data[0].get("replies_count") or 0
            new_count = max(0, current_count - 1)
            db.table("posts").update({"replies_count": new_count}).eq("id", parent_id).execute()

    return {"message": "Post removed by admin"}


@router.get("/check")
async def check_admin(admin: dict = Depends(verify_admin)):
    return {"is_admin": True}
