import hashlib
import random
import secrets
from datetime import datetime, timedelta, timezone

import resend
from fastapi import APIRouter, HTTPException, Request, Response
from jose import jwt
from pydantic import BaseModel, EmailStr

from config import get_settings
from database import get_supabase
from rate_limit import RateLimit, enforce

# Rate limit rules live at module scope so the RateLimit instances are
# stable across warm invocations.
# - OTP send: 3 / minute / ip AND 5 / hour / email. Two dimensions so
#   neither a single IP spamming lots of addresses nor a distributed botnet
#   hammering one address can run up our Resend bill.
# - OTP verify: 10 / 10 minutes / ip+email. The bucket is per (email), so a
#   brute-forcer would need ~90k different sessions, each capped at 10
#   guesses per 10 minutes, before the code expires — makes 900k-space
#   guessing comfortably infeasible.
_OTP_SEND_BY_IP = RateLimit(limit=3, window_s=60)
_OTP_SEND_BY_EMAIL = RateLimit(limit=5, window_s=3600)
_OTP_VERIFY_BY_EMAIL = RateLimit(limit=10, window_s=600)

router = APIRouter(prefix="/auth", tags=["auth"])

COLORS = [
    "Purple", "Crimson", "Golden", "Silver", "Emerald", "Azure", "Coral",
    "Indigo", "Scarlet", "Teal", "Amber", "Jade", "Onyx", "Ruby", "Sage",
    "Cobalt", "Ivory", "Slate", "Blush", "Frost", "Neon", "Velvet", "Copper",
    "Midnight", "Solar", "Arctic", "Dusty", "Burnt", "Misty", "Storm",
    "Shadow", "Bright", "Deep", "Wild", "Silent", "Dark", "Pale", "Warm",
    "Cool", "Vivid",
]

ANIMALS = [
    "Tiger", "Falcon", "Panda", "Wolf", "Phoenix", "Otter", "Lynx",
    "Hawk", "Bear", "Fox", "Eagle", "Raven", "Cobra", "Stag", "Viper",
    "Owl", "Shark", "Crane", "Jaguar", "Bison", "Panther", "Mantis",
    "Badger", "Heron", "Gecko", "Moth", "Sparrow", "Dolphin", "Moose",
    "Condor", "Coyote", "Marten", "Ferret", "Osprey", "Puma", "Rhino",
    "Lemur", "Chameleon", "Wombat", "Pelican", "Ibis", "Toucan", "Bison",
    "Gazelle", "Meerkat", "Orca", "Penguin", "Quail", "Iguana", "Yak",
]


class SendOTPRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str


def hash_email(email: str) -> str:
    settings = get_settings()
    return hashlib.sha256(
        (email.lower().strip() + settings.secret_salt).encode()
    ).hexdigest()


def generate_persona(db) -> str:
    # O(1) per attempt: pick a random combo, check if it exists with a targeted count query.
    # Expected < 2 attempts at campus scale (2000 combos, typical users << 2000).
    for _ in range(50):
        color = random.choice(COLORS)
        animal = random.choice(ANIMALS)
        name = f"{color}{animal}"
        result = (
            db.table("users")
            .select("id", count="exact")
            .eq("persona_name", name)
            .execute()
        )
        if (result.count or 0) == 0:
            return name
    raise HTTPException(status_code=500, detail="No unique persona names available")


def create_jwt(user_id: str) -> str:
    settings = get_settings()
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@router.post("/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"verify_exp": False},
        )
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    db = get_supabase()
    user = db.table("users").select("id, persona_name").eq("id", user_id).execute()
    if not user.data:
        raise HTTPException(status_code=401, detail="User not found")

    new_token = create_jwt(user_id)
    is_prod = settings.environment == "production"
    response.set_cookie(
        key="token",
        value=new_token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=30 * 24 * 3600,
    )
    return {"token": new_token}


@router.post("/send-otp")
async def send_otp(body: SendOTPRequest, request: Request):
    email = body.email.lower().strip()

    if not email.endswith("@iitb.ac.in"):
        raise HTTPException(status_code=400, detail="Only @iitb.ac.in emails are allowed")

    enforce("otp.send", _OTP_SEND_BY_IP, request=request)
    enforce("otp.send.email", _OTP_SEND_BY_EMAIL, identifier=email)

    settings = get_settings()
    db = get_supabase()

    otp_code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()

    db.table("otp_verifications").insert({
        "email": email,
        "otp_code": otp_code,
        "expires_at": expires_at,
        "used": False,
    }).execute()

    resend.api_key = settings.resend_api_key
    resend.Emails.send({
        "from": "HangOwl <noreply@verify.hangowl.com>",
        "to": email,
        "subject": "Your HangOwl OTP",
        "html": (
            f"<div style='font-family:Inter,sans-serif;padding:24px;'>"
            f"<h2 style='color:#F5A623;'>HangOwl Verification</h2>"
            f"<p>Your OTP is: <strong style='font-size:24px;letter-spacing:4px;'>{otp_code}</strong></p>"
            f"<p style='color:#888;'>Expires in 10 minutes. Don't share this with anyone.</p>"
            f"</div>"
        ),
    })

    return {"message": "OTP sent successfully"}


@router.post("/verify-otp")
async def verify_otp(body: VerifyOTPRequest, request: Request, response: Response):
    email = body.email.lower().strip()

    if not email.endswith("@iitb.ac.in"):
        raise HTTPException(status_code=400, detail="Only @iitb.ac.in emails are allowed")

    # Bucket by email (not IP alone) so a residential NAT doesn't accidentally
    # lock out roommates, but brute-force against a single address still caps
    # at 10 guesses per 10 minutes.
    enforce("otp.verify", _OTP_VERIFY_BY_EMAIL, identifier=email)

    db = get_supabase()

    result = (
        db.table("otp_verifications")
        .select("*")
        .eq("email", email)
        .eq("otp_code", body.otp_code)
        .eq("used", False)
        .gte("expires_at", datetime.now(timezone.utc).isoformat())
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    otp_record = result.data[0]

    db.table("otp_verifications").update({"used": True}).eq("id", otp_record["id"]).execute()

    email_hash = hash_email(email)

    existing = (
        db.table("users")
        .select("id, persona_name")
        .eq("email_hash", email_hash)
        .execute()
    )

    is_prod = get_settings().environment == "production"
    now = datetime.now(timezone.utc).isoformat()

    if existing.data:
        user = existing.data[0]
        token = create_jwt(user["id"])
        db.table("users").update({"last_active_at": now}).eq("id", user["id"]).execute()
        response.set_cookie(
            key="token",
            value=token,
            httponly=True,
            secure=is_prod,
            samesite="none" if is_prod else "lax",
            max_age=7 * 24 * 3600,
        )
        return {
            "message": "Welcome back!",
            "persona_name": user["persona_name"],
            "user_id": user["id"],
            "token": token,
            "is_new": False,
        }

    persona_name = generate_persona(db)

    new_user = (
        db.table("users")
        .insert({
            "email_hash": email_hash,
            "persona_name": persona_name,
            "vibe_score": 0,
            "hangout_count": 0,
            "persona_badge": "New Owl",
            "last_active_at": now,
        })
        .execute()
    )

    user = new_user.data[0]
    token = create_jwt(user["id"])

    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=7 * 24 * 3600,
    )

    db.table("otp_verifications").delete().eq("email", email).execute()

    return {
        "message": "Welcome to HangOwl!",
        "persona_name": persona_name,
        "user_id": user["id"],
        "token": token,
        "is_new": True,
    }
