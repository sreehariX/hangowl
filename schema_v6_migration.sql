-- Add image support to plans
alter table plans add column if not exists image_url text;
