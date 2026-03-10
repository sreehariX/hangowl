-- Add admin flag to users
alter table users add column if not exists is_admin boolean default false;

-- Set BlushRaven#5763 as admin
update users set is_admin = true where persona_name = 'BlushRaven#5763';

-- User bans table
create table if not exists user_bans (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references users(id) on delete cascade not null,
  banned_by uuid references users(id) on delete set null,
  ban_type text not null check (ban_type in ('1_week', '1_month', 'permanent')),
  reason text,
  banned_until timestamp with time zone,
  created_at timestamp with time zone default now()
);

create index if not exists idx_user_bans_user_id on user_bans(user_id);

alter table user_bans enable row level security;

create policy "Admins can manage bans" on user_bans for all using (true);
