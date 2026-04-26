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


def _count(db, table: str, gte_col: str | None = None, gte_iso: str | None = None,
           extra_eq: dict | None = None) -> int:
    """Run a `count="exact"` SELECT and return the integer count.

    Supabase returns `count` on the response object even when `data` is empty,
    so we always pull a single column to keep the payload tiny.
    """
    q = db.table(table).select("id", count="exact")
    if gte_col and gte_iso:
        q = q.gte(gte_col, gte_iso)
    if extra_eq:
        for k, v in extra_eq.items():
            q = q.eq(k, v)
    res = q.limit(1).execute()
    return res.count or 0


@router.get("/metrics")
async def get_metrics(admin: dict = Depends(verify_admin)):
    """Growth + activity dashboard for admins.

    Skips metrics that don't apply to the current product:
      * Revenue — no monetization yet
      * NPS — no in-app survey
      * Cohort retention — needs proper cohort buckets, deferred
    """
    db = get_supabase()
    now = datetime.now(timezone.utc)

    iso = lambda d: d.isoformat()  # noqa: E731 - tiny local helper
    five_min_ago = iso(now - timedelta(minutes=5))
    day_ago = iso(now - timedelta(days=1))
    week_ago = iso(now - timedelta(days=7))
    month_ago = iso(now - timedelta(days=30))
    today_start = iso(now.replace(hour=0, minute=0, second=0, microsecond=0))

    # Registrations
    total_users = _count(db, "users")
    new_users_today = _count(db, "users", "created_at", today_start)
    new_users_week = _count(db, "users", "created_at", week_ago)
    new_users_month = _count(db, "users", "created_at", month_ago)

    # Active users (based on last heartbeat / page activity)
    online_now = _count(db, "users", "last_active_at", five_min_ago)
    dau = _count(db, "users", "last_active_at", day_ago)
    wau = _count(db, "users", "last_active_at", week_ago)
    mau = _count(db, "users", "last_active_at", month_ago)

    # Activity levels — what users are actually doing on the platform
    total_posts = _count(db, "posts", extra_eq={"is_hidden": False})
    posts_today = _count(db, "posts", "created_at", today_start, extra_eq={"is_hidden": False})
    posts_week = _count(db, "posts", "created_at", week_ago, extra_eq={"is_hidden": False})

    total_plans = _count(db, "plans", extra_eq={"is_hidden": False})
    plans_today = _count(db, "plans", "created_at", today_start, extra_eq={"is_hidden": False})
    plans_week = _count(db, "plans", "created_at", week_ago, extra_eq={"is_hidden": False})
    active_plans = (
        db.table("plans")
        .select("id", count="exact")
        .eq("is_hidden", False)
        .gt("ends_at", iso(now))
        .limit(1)
        .execute()
        .count
        or 0
    )

    total_likes = _count(db, "post_likes")
    likes_today = _count(db, "post_likes", "created_at", today_start)

    plan_joins = _count(db, "plan_members")
    plan_joins_week = _count(db, "plan_members", "joined_at", week_ago)

    # Engagement ratios — these are the diagnostic numbers we actually look at.
    # Avoid divide-by-zero for a fresh install.
    def _pct(n: int, d: int) -> float:
        return round((n / d) * 100, 1) if d else 0.0

    return {
        "generated_at": iso(now),
        "registrations": {
            "total": total_users,
            "new_today": new_users_today,
            "new_this_week": new_users_week,
            "new_this_month": new_users_month,
        },
        "active_users": {
            "online_now": online_now,
            "dau": dau,
            "wau": wau,
            "mau": mau,
            "dau_over_mau_pct": _pct(dau, mau),
            "wau_over_mau_pct": _pct(wau, mau),
        },
        "activity": {
            "posts_total": total_posts,
            "posts_today": posts_today,
            "posts_this_week": posts_week,
            "likes_total": total_likes,
            "likes_today": likes_today,
            "plans_total": total_plans,
            "plans_today": plans_today,
            "plans_this_week": plans_week,
            "plans_active_now": active_plans,
            "plan_joins_total": plan_joins,
            "plan_joins_this_week": plan_joins_week,
        },
    }
