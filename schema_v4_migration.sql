-- Posts table
create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  content text not null check (char_length(content) <= 500),
  image_url text,
  parent_id uuid references posts(id) on delete cascade,
  likes_count int default 0,
  replies_count int default 0,
  is_hidden boolean default false,
  created_at timestamp with time zone default now()
);

create index if not exists idx_posts_created_at on posts(created_at desc);
create index if not exists idx_posts_parent_id on posts(parent_id, created_at desc);
create index if not exists idx_posts_user_id on posts(user_id, created_at desc);

alter table posts enable row level security;

create policy "Anyone can read posts" on posts for select using (true);
create policy "Authenticated users can insert posts" on posts for insert with check (true);
create policy "Users can update own posts" on posts for update using (true);

-- Post likes table
create table if not exists post_likes (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique(post_id, user_id)
);

create index if not exists idx_post_likes_post_id on post_likes(post_id);
create index if not exists idx_post_likes_user_id on post_likes(user_id);

alter table post_likes enable row level security;

create policy "Anyone can read likes" on post_likes for select using (true);
create policy "Authenticated users can insert likes" on post_likes for insert with check (true);
create policy "Authenticated users can delete likes" on post_likes for delete using (true);

-- Realtime
alter publication supabase_realtime add table posts;
alter publication supabase_realtime add table post_likes;

-- Supabase Storage: run this in the Supabase dashboard SQL editor
-- insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true);
-- create policy "Anyone can read post images" on storage.objects for select using (bucket_id = 'post-images');
-- create policy "Authenticated users can upload post images" on storage.objects for insert with check (bucket_id = 'post-images');
