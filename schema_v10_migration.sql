-- Add multi-image support to posts.
-- Posts can now carry up to 4 image URLs. We keep the legacy `image_url`
-- column populated with the first image so older clients keep rendering.

ALTER TABLE posts ADD COLUMN IF NOT EXISTS image_urls text[];

-- Backfill: any existing post with a single `image_url` becomes a
-- one-element array so the UI can treat every post uniformly.
UPDATE posts
   SET image_urls = ARRAY[image_url]
 WHERE image_url IS NOT NULL
   AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

-- Enforce the 4-image cap at the database layer for safety.
ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS posts_image_urls_max_len;
ALTER TABLE posts
  ADD CONSTRAINT posts_image_urls_max_len
  CHECK (image_urls IS NULL OR array_length(image_urls, 1) <= 4);
