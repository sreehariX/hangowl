import hashlib
import random
import secrets
from datetime import datetime, timedelta, timezone

import resend
from fastapi import APIRouter, HTTPException, Response
from jose import jwt
from pydantic import BaseModel, EmailStr

from config import get_settings
from database import get_supabase

router = APIRouter(prefix="/auth", tags=["auth"])

COLORS = [
    "Purple", "Crimson", "Golden", "Silver", "Emerald", "Azure", "Coral",
    "Indigo", "Scarlet", "Teal", "Amber", "Jade", "Onyx", "Ruby", "Sage",
    "Cobalt", "Ivory", "Slate", "Blush", "Frost",
]

ANIMALS = [
    "Tiger", "Falcon", "Panda", "Wolf", "Phoenix", "Otter", "Lynx",
    "Hawk", "Bear", "Fox", "Eagle", "Raven", "Cobra", "Stag", "Viper",
    "Owl", "Shark", "Crane", "Jaguar", "Bison",
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
    for _ in range(20):
        color = random.choice(COLORS)
        animal = random.choice(ANIMALS)
        number = random.randint(1000, 9999)
        name = f"{color}{animal}#{number}"

        result = (
            db.table("users")
            .select("id")
            .eq("persona_name", name)
            .execute()
        )
        if not result.data:
            return name

    raise HTTPException(status_code=500, detail="Failed to generate unique persona")


def create_jwt(user_id: str) -> str:
    settings = get_settings()
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


@router.post("/send-otp")
async def send_otp(body: SendOTPRequest):
    email = body.email.lower().strip()

    if not email.endswith("@iitb.ac.in"):
        raise HTTPException(status_code=400, detail="Only @iitb.ac.in emails are allowed")

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
async def verify_otp(body: VerifyOTPRequest, response: Response):
    email = body.email.lower().strip()

    if not email.endswith("@iitb.ac.in"):
        raise HTTPException(status_code=400, detail="Only @iitb.ac.in emails are allowed")

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

    if existing.data:
        user = existing.data[0]
        token = create_jwt(user["id"])
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
