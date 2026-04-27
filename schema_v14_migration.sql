-- Per-user read cursors for independent hangout chats.
--
-- This gives each plan chat WhatsApp-style unread state: opening one
-- hangout marks only that plan's chat as read, and counts survive app
-- refreshes / device changes because the cursor lives in Postgres.

create table if not exists plan_chat_reads (
  plan_id uuid references plans(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade not null,
  last_read_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  primary key (plan_id, user_id)
);

create index if not exists idx_plan_chat_reads_user_plan
  on plan_chat_reads(user_id, plan_id);

alter table plan_chat_reads enable row level security;
