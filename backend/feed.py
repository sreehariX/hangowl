import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from config import get_settings
from database import get_supabase
from middleware import verify_token

router = APIRouter(prefix="/feed", tags=["feed"])

PAGE_SIZE = 20


MAX_IMAGES_PER_POST = 4


class CreatePostRequest(BaseModel):
    content: str
    image_url: Optional[str] = None
    image_urls: Optional[list[str]] = None
    parent_id: Optional[str] = None


@router.get("")
async def get_feed(cursor: Optional[str] = None, user_id_filter: Optional[str] = None):
    db = get_supabase()

    COLS = "id, user_id, content, image_url, image_urls, parent_id, likes_count, replies_count, views_count, created_at, users(persona_name)"
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
    posts = result.data

    # Batch-fetch top reply for posts that have replies.
    # Algorithm: author's own reply (self-thread) > most-liked reply (≥1 like).
    posts_with_replies = [p for p in posts if (p.get("replies_count") or 0) > 0]

    if posts_with_replies:
        post_ids = [p["id"] for p in posts_with_replies]
        post_author_map = {p["id"]: p["user_id"] for p in posts_with_replies}

        # Query A: most-liked replies (any author, ≥1 like)
        liked_res = (
            db.table("posts")
            .select(COLS)
            .in_("parent_id", post_ids)
            .eq("is_hidden", False)
            .gt("likes_count", 0)
            .order("likes_count", desc=True)
            .limit(min(len(post_ids) * 3, 60))
            .execute()
        )

        # Query B: potential self-replies (author replies to own post)
        author_ids = list(set(post_author_map.values()))
        self_res = (
            db.table("posts")
            .select(COLS)
            .in_("parent_id", post_ids)
            .in_("user_id", author_ids)
            .eq("is_hidden", False)
            .order("created_at", desc=False)
            .limit(len(post_ids) * 2)
            .execute()
        )

        # Build top_reply map: author reply > liked reply
        top_replies: dict = {}

        # Seed with most-liked replies first
        for reply in liked_res.data:
            pid = reply["parent_id"]
            if pid not in top_replies:
                top_replies[pid] = reply

        # Override with author's own reply (takes priority)
        for reply in self_res.data:
            pid = reply["parent_id"]
            if reply["user_id"] == post_author_map.get(pid):
                top_replies[pid] = reply

        # Attach to posts
        for post in posts:
            post["top_reply"] = top_replies.get(post["id"])

    return {"posts": posts}


def _notify_reply(parent_post_id: str, actor_id: str, parent_owner_id: str) -> None:
    db = get_supabase()
    actor_user = db.table("users").select("persona_name").eq("id", actor_id).execute()
    actor_persona = actor_user.data[0]["persona_name"] if actor_user.data else "Someone"
    db.table("notifications").insert({
        "user_id": parent_owner_id,
        "type": "reply",
        "actor_id": actor_id,
        "actor_persona": actor_persona,
        "post_id": parent_post_id,
    }).execute()


@router.post("")
async def create_post(body: CreatePostRequest, bg: BackgroundTasks, user: dict = Depends(verify_token)):
    db = get_supabase()

    content = body.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Post content is required")
    if len(content) > 500:
        raise HTTPException(status_code=400, detail="Post content too long (max 500 chars)")

    # Merge legacy single-image field with the new array field, dedupe, cap.
    images: list[str] = []
    if body.image_urls:
        images.extend([u for u in body.image_urls if isinstance(u, str) and u])
    if body.image_url and body.image_url not in images:
        images.insert(0, body.image_url)
    images = images[:MAX_IMAGES_PER_POST]
    if len(body.image_urls or []) > MAX_IMAGES_PER_POST:
        raise HTTPException(
            status_code=400,
            detail=f"A post can have at most {MAX_IMAGES_PER_POST} images",
        )

    insert_data = {
        "user_id": user["sub"],
        "content": content,
        "image_url": images[0] if images else None,
        "image_urls": images if images else None,
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

            parent_owner_id = parent_post.data[0].get("user_id")
            if parent_owner_id and parent_owner_id != user["sub"]:
                bg.add_task(_notify_reply, body.parent_id, user["sub"], parent_owner_id)

    return {"post": post}


@router.get("/my")
async def get_my_posts(user: dict = Depends(verify_token), cursor: Optional[str] = None):
    db = get_supabase()
    COLS = "id, user_id, content, image_url, image_urls, parent_id, likes_count, replies_count, views_count, created_at, users(persona_name)"
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


def _do_record_view(post_id: str) -> None:
    db = get_supabase()
    post = db.table("posts").select("views_count").eq("id", post_id).eq("is_hidden", False).execute()
    if post.data:
        current = post.data[0].get("views_count") or 0
        db.table("posts").update({"views_count": current + 1}).eq("id", post_id).execute()


@router.post("/{post_id}/view")
async def record_view(post_id: str, bg: BackgroundTasks):
    bg.add_task(_do_record_view, post_id)
    return {"ok": True}


# Dynamic {post_id} routes must come AFTER all static routes
@router.get("/{post_id}")
async def get_post(post_id: str):
    db = get_supabase()

    COLS = "id, user_id, content, image_url, image_urls, parent_id, likes_count, replies_count, views_count, created_at, users(persona_name)"
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

    replies = replies_result.data

    # Fetch sub-replies (replies to replies) for threaded display
    sub_replies = []
    reply_ids = [r["id"] for r in replies]
    if reply_ids:
        sub_result = (
            db.table("posts")
            .select(COLS)
            .in_("parent_id", reply_ids)
            .eq("is_hidden", False)
            .order("created_at", desc=False)
            .limit(200)
            .execute()
        )
        sub_replies = sub_result.data

    return {"post": post_result.data[0], "replies": replies, "sub_replies": sub_replies}


@router.delete("/{post_id}")
async def hide_post(post_id: str, user: dict = Depends(verify_token)):
    db = get_supabase()

    post_result = (
        db.table("posts")
        .select("user_id, parent_id")
        .eq("id", post_id)
        .execute()
    )

    if not post_result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    if post_result.data[0]["user_id"] != user["sub"]:
        raise HTTPException(status_code=403, detail="Only the author can delete this post")

    db.table("posts").update({"is_hidden": True}).eq("id", post_id).execute()

    parent_id = post_result.data[0].get("parent_id")
    if parent_id:
        parent_result = db.table("posts").select("replies_count").eq("id", parent_id).execute()
        if parent_result.data:
            current_count = parent_result.data[0].get("replies_count") or 0
            new_count = max(0, current_count - 1)
            db.table("posts").update({"replies_count": new_count}).eq("id", parent_id).execute()

    return {"message": "Post deleted"}


def _notify_like(post_id: str, actor_id: str, post_owner_id: str) -> None:
    db = get_supabase()
    actor_user = db.table("users").select("persona_name").eq("id", actor_id).execute()
    actor_persona = actor_user.data[0]["persona_name"] if actor_user.data else "Someone"
    db.table("notifications").insert({
        "user_id": post_owner_id,
        "type": "like",
        "actor_id": actor_id,
        "actor_persona": actor_persona,
        "post_id": post_id,
    }).execute()


@router.post("/{post_id}/like")
async def toggle_like(post_id: str, bg: BackgroundTasks, user: dict = Depends(verify_token)):
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

        post_owner_id = post_result.data[0].get("user_id") if post_result.data else None
        if post_owner_id and post_owner_id != user["sub"]:
            bg.add_task(_notify_like, post_id, user["sub"], post_owner_id)

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
