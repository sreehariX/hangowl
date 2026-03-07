-- Plan messages for chat
create table if not exists plan_messages (
  id uuid default gen_random_uuid() primary key,
  plan_id uuid references plans(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  message text not null,
  created_at timestamp with time zone default now()
);

create index if not exists idx_plan_messages_plan_id on plan_messages(plan_id, created_at);

alter table plan_messages enable row level security;

create policy "Anyone can read plan messages"
  on plan_messages for select using (true);

create policy "Authenticated users can insert messages"
  on plan_messages for insert with check (true);

alter publication supabase_realtime add table plan_messages;

-- Soft delete for plans
alter table plans add column if not exists is_hidden boolean default false;
