-- Enable Supabase Realtime for the `notifications` table.
--
-- Why: the frontend already subscribes to postgres_changes on this table
-- (see lib/notifications-context.tsx), but schema.sql only added `plans`
-- and `plan_members` to the `supabase_realtime` publication back in v0.
-- Without membership in that publication, Postgres never streams INSERTs
-- out, so the bell badge only ever updates after a full page refresh
-- (because `getUnreadCount()` re-runs on mount).
--
-- Adding the table to the publication is safe and idempotent-ish: we
-- DROP ... IF EXISTS first so re-running the migration on a deployment
-- that already applied it just re-asserts membership.
--
-- No-op if the table is already in the publication; Postgres errors
-- loudly ("relation ... is already member of publication") otherwise,
-- so we guard with a DO block that swallows that specific case.

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION
  WHEN duplicate_object THEN
    -- Already a member, nothing to do.
    NULL;
END $$;
