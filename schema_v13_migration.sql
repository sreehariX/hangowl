-- Lock down user_bans so the anon role can't read or modify the
-- moderation table.
--
-- v5 created user_bans with `for all using (true)`, which gives the
-- anonymous role full SELECT/INSERT/UPDATE/DELETE access. The frontend
-- never reads or writes this table — only the backend admin endpoints
-- touch it, and they use the service key (which bypasses RLS). With RLS
-- on and zero remaining policies for the anon role, every anonymous
-- request is denied by default while the backend keeps working.
--
-- Notifications are deliberately left without per-row RLS for now: the
-- realtime bell badge relies on Supabase Realtime + the anon role
-- reading a filtered row stream, and our auth model uses our own JWTs
-- (not Supabase Auth) so there's no auth.uid() to compare against. A
-- proper hardening pass for that table requires switching the realtime
-- subscription to a backend-broadcast channel, which is a bigger
-- refactor than this audit warrants. Tracked separately.

DROP POLICY IF EXISTS "Admins can manage bans" ON user_bans;
