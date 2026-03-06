-- HangOwl Database Schema for Supabase

-- Users (no emails stored - only hash and persona)
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email_hash text unique not null,
  persona_name text unique not null,
  hostel text,
  vibe_score int default 0,
  hangout_count int default 0,
  persona_badge text default 'New Owl',
  created_at timestamp with time zone default now()
);

-- Plans (what people want to do)
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references users(id) on delete cascade,
  activity text not null,
  location text not null,
  description text default '',
  max_people int default 10,
  expires_at timestamp with time zone not null,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

-- Plan members
create table if not exists plan_members (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  joined_at timestamp with time zone default now(),
  unique(plan_id, user_id)
);

-- OTP verifications (temporary, deleted after use)
create table if not exists otp_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_code text not null,
  expires_at timestamp with time zone not null,
  used boolean default false,
  created_at timestamp with time zone default now()
);

-- Indexes
create index if not exists idx_plans_active on plans(is_active, expires_at);
create index if not exists idx_plans_creator on plans(creator_id);
create index if not exists idx_plan_members_plan on plan_members(plan_id);
create index if not exists idx_plan_members_user on plan_members(user_id);
create index if not exists idx_users_hostel on users(hostel);
create index if not exists idx_otp_email on otp_verifications(email, used);

-- Enable realtime for plans and plan_members
alter publication supabase_realtime add table plans;
alter publication supabase_realtime add table plan_members;

-- Row Level Security
alter table users enable row level security;
alter table plans enable row level security;
alter table plan_members enable row level security;
alter table otp_verifications enable row level security;

-- Plans are publicly readable
create policy "Plans are viewable by everyone" on plans
  for select using (true);

-- Plan members are publicly readable
create policy "Plan members are viewable by everyone" on plan_members
  for select using (true);

-- Users are publicly readable (only persona info exposed)
create policy "User profiles are viewable by everyone" on users
  for select using (true);
