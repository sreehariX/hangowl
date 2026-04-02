import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from config import get_settings
from database import get_supabase
from middleware import verify_token

router = APIRouter(prefix="/feed", tags=["feed"])

PAGE_SIZE = 20


class CreatePostRequest(BaseModel):
    content: str
    image_url: Optional[str] = None
    parent_id: Optional[str] = None


@router.get("")
async def get_feed(cursor: Optional[str] = None, user_id_filter: Optional[str] = None):
    db = get_supabase()

    COLS = "id, user_id, content, image_url, parent_id, likes_count, replies_count, views_count, created_at, users(persona_name)"
    query = (
        db.table("posts")
        .select(COLS)
        .is_("parent_id", "null")
        .eq("is_hidden", False)
        .order("created_at", desc=True)
        .limit(PAGE_SIZE)
    )

    if cursor:
        query = query.lt("created_at", cursor)

    if user_id_filter:
        query = query.eq("user_id", user_id_filter)

    result = query.execute()
    return {"posts": result.data}


@router.post("")
async def create_post(body: CreatePostRequest, user: dict = Depends(verify_token)):
    db = get_supabase()

    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Post content is required")
    if len(content) > 500:
        raise HTTPException(status_code=400, detail="Post content too long (max 500 chars)")

    insert_data = {
        "user_id": user["sub"],
        "content": content,
        "image_url": body.image_url,
        "is_hidden": False,
    }

    if body.parent_id:
        parent = (
            db.table("posts")
            .select("id")
            .eq("id", body.parent_id)
            .eq("is_hidden", False)
            .execute()
        )
        if not parent.data:
            raise HTTPException(status_code=404, detail="Parent post not found")
        insert_data["parent_id"] = body.parent_id

    result = db.table("posts").insert(insert_data).execute()
    post = result.data[0]

    if body.parent_id:
        parent_post = (
            db.table("posts")
            .select("replies_count, user_id")
            .eq("id", body.parent_id)
            .execute()
        )
        if parent_post.data:
            new_count = (parent_post.data[0].get("replies_count") or 0) + 1
            db.table("posts").update({"replies_count": new_count}).eq("id", body.parent_id).execute()

            # Notify parent post owner (skip if same user)
            parent_owner_id = parent_post.data[0].get("user_id")
            if parent_owner_id and parent_owner_id != user["sub"]:
                actor_user = db.table("users").select("persona_name").eq("id", user["sub"]).execute()
                actor_persona = actor_user.data[0]["persona_name"] if actor_user.data else "Someone"
                db.table("notifications").insert({
                    "user_id": parent_owner_id,
                    "type": "reply",
                    "actor_id": user["sub"],
                    "actor_persona": actor_persona,
                    "post_id": body.parent_id,
                }).execute()

    return {"post": post}


@router.get("/my")
async def get_my_posts(user: dict = Depends(verify_token), cursor: Optional[str] = None):
    db = get_supabase()
    COLS = "id, user_id, content, image_url, parent_id, likes_count, replies_count, views_count, created_at, users(persona_name)"
    query = (
        db.table("posts")
        .select(COLS)
        .eq("user_id", user["sub"])
        .eq("is_hidden", False)
        .order("created_at", desc=True)
        .limit(PAGE_SIZE)
    )

    if cursor:
        query = query.lt("created_at", cursor)

    result = query.execute()
    return {"posts": result.data}


@router.get("/my/liked-ids")
async def get_liked_post_ids(user: dict = Depends(verify_token)):
    db = get_supabase()

    result = (
        db.table("post_likes")
        .select("post_id")
        .eq("user_id", user["sub"])
        .execute()
    )

    return {"post_ids": [r["post_id"] for r in result.data]}


@router.post("/upload")
async def upload_image(file: UploadFile = File(...), user: dict = Depends(verify_token)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image must be under 10MB")

    ext = (file.filename or "img.jpg").rsplit(".", 1)[-1] if file.filename else "jpg"
    path = f"{uuid.uuid4().hex}.{ext}"

    try:
        db = get_supabase()
        db.storage.from_("post-images").upload(path, contents, {"content-type": file.content_type})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {str(e)}")

    settings = get_settings()
    public_url = f"{settings.supabase_url}/storage/v1/object/public/post-images/{path}"
    return {"url": public_url}


@router.post("/{post_id}/view")
async def record_view(post_id: str):
    db = get_supabase()
    post = db.table("posts").select("views_count").eq("id", post_id).eq("is_hidden", False).execute()
    if post.data:
        current = post.data[0].get("views_count") or 0
        db.table("posts").update({"views_count": current + 1}).eq("id", post_id).execute()
    return {"ok": True}


# Dynamic {post_id} routes must come AFTER all static routes
@router.get("/{post_id}")
async def get_post(post_id: str):
    db = get_supabase()

    COLS = "id, user_id, content, image_url, parent_id, likes_count, replies_count, views_count, created_at, users(persona_name)"
    post_result = (
        db.table("posts")
        .select(COLS)
        .eq("id", post_id)
        .eq("is_hidden", False)
        .execute()
    )

    if not post_result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    replies_result = (
        db.table("posts")
        .select(COLS)
        .eq("parent_id", post_id)
        .eq("is_hidden", False)
        .order("created_at", desc=False)
        .limit(100)
        .execute()
    )

    return {"post": post_result.data[0], "replies": replies_result.data}


@router.delete("/{post_id}")
async def hide_post(post_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()

    post_result = (
        db.table("posts")
        .select("user_id")
        .eq("id", post_id)
        .execute()
    )

    if not post_result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    if post_result.data[0]["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the author can delete this post")

    db.table("posts").update({"is_hidden": True}).eq("id", post_id).execute()
    return {"message": "Post deleted"}


@router.post("/{post_id}/like")
async def toggle_like(post_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()

    post_result = (
        db.table("posts")
        .select("id, likes_count, user_id")
        .eq("id", post_id)
        .eq("is_hidden", False)
        .execute()
    )

    if not post_result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = (
        db.table("post_likes")
        .select("id")
        .eq("post_id", post_id)
        .eq("user_id", user["sub"])
        .execute()
    )

    current_count = post_result.data[0].get("likes_count") or 0

    if existing.data:
        db.table("post_likes").delete().eq("id", existing.data[0]["id"]).execute()
        new_count = max(0, current_count - 1)
        db.table("posts").update({"likes_count": new_count}).eq("id", post_id).execute()
        return {"liked": False, "likes_count": new_count}
    else:
        db.table("post_likes").insert({
            "post_id": post_id,
            "user_id": user["sub"],
        }).execute()
        new_count = current_count + 1
        db.table("posts").update({"likes_count": new_count}).eq("id", post_id).execute()

        # Notify post owner (skip if liker == owner)
        post_owner_id = post_result.data[0].get("user_id") if post_result.data else None
        if post_owner_id and post_owner_id != user["sub"]:
            actor_user = db.table("users").select("persona_name").eq("id", user["sub"]).execute()
            actor_persona = actor_user.data[0]["persona_name"] if actor_user.data else "Someone"
            db.table("notifications").insert({
                "user_id": post_owner_id,
                "type": "like",
                "actor_id": user["sub"],
                "actor_persona": actor_persona,
                "post_id": post_id,
            }).execute()

        return {"liked": True, "likes_count": new_count}


@router.get("/{post_id}/liked")
async def check_liked(post_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()

    existing = (
        db.table("post_likes")
        .select("id")
        .eq("post_id", post_id)
        .eq("user_id", user["sub"])
        .execute()
    )

    return {"liked": len(existing.data) > 0}
