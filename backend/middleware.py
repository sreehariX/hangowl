from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request
from jose import JWTError, jwt

from config import get_settings
from database import get_supabase


async def verify_token(request: Request) -> dict:
    token = request.cookies.get("token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    db = get_supabase()
    now = datetime.now(timezone.utc).isoformat()
    ban = (
        db.table("user_bans")
        .select("id, ban_type, banned_until")
        .eq("user_id", payload["sub"])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if ban.data:
        b = ban.data[0]
        if b["ban_type"] == "permanent" or (b["banned_until"] and b["banned_until"] > now):
            raise HTTPException(status_code=403, detail="Your account is banned")

    return payload


async def verify_admin(request: Request) -> dict:
    payload = await verify_token(request)
    db = get_supabase()
    user = (
        db.table("users")
        .select("is_admin")
        .eq("id", payload["sub"])
        .execute()
    )
    if not user.data or not user.data[0].get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin access required")
    return payload


get_current_user = Depends(verify_token)
