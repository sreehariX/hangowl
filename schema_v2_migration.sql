alter table plans add column if not exists starts_at timestamp with time zone;
alter table plans add column if not exists ends_at timestamp with time zone;
alter table plans add column if not exists plan_date date;

alter table users add column if not exists last_active_at timestamp with time zone;

drop index if exists idx_plans_active;
create index if not exists idx_plans_ends_at on plans(ends_at);
create index if not exists idx_plans_date on plans(plan_date);
create index if not exists idx_users_last_active on users(last_active_at);
