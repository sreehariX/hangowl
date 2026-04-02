-- Performance indexes to speed up the most common queries

-- Feed: main feed query filters by is_hidden=false, parent_id IS NULL, orders by created_at
CREATE INDEX IF NOT EXISTS idx_posts_feed
  ON posts(created_at DESC)
  WHERE is_hidden = FALSE AND parent_id IS NULL;

-- Feed: user's own posts
CREATE INDEX IF NOT EXISTS idx_posts_user_feed
  ON posts(user_id, created_at DESC)
  WHERE is_hidden = FALSE;

-- Feed: replies for a given post
CREATE INDEX IF NOT EXISTS idx_posts_replies
  ON posts(parent_id, created_at)
  WHERE is_hidden = FALSE AND parent_id IS NOT NULL;

-- Likes: toggle like checks (post_id, user_id) pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_likes_pair
  ON post_likes(post_id, user_id);

-- Likes: fetch all liked post IDs for a user
CREATE INDEX IF NOT EXISTS idx_post_likes_user
  ON post_likes(user_id);

-- Plans: active plan listing (most frequent query)
CREATE INDEX IF NOT EXISTS idx_plans_active
  ON plans(ends_at, starts_at)
  WHERE is_hidden = FALSE;

-- Plans: creator lookup for my plans
CREATE INDEX IF NOT EXISTS idx_plans_creator
  ON plans(creator_id)
  WHERE is_hidden = FALSE;

-- Plan members: membership lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_members_pair
  ON plan_members(plan_id, user_id);

CREATE INDEX IF NOT EXISTS idx_plan_members_user
  ON plan_members(user_id);

-- Notifications: unread count (most polled query)
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(user_id)
  WHERE is_read = FALSE;

-- Notifications: full list for a user ordered by time
CREATE INDEX IF NOT EXISTS idx_notifications_user_time
  ON notifications(user_id, created_at DESC);
