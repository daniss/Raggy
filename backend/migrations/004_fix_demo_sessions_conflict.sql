-- Fix ON CONFLICT target for update_demo_activity()
-- Ensure a unique or exclusion constraint exists on demo_sessions(demo_signup_id)

BEGIN;

-- 1) Optional: Deduplicate existing rows to allow adding the unique constraint
WITH ranked AS (
    SELECT id,
           demo_signup_id,
           ROW_NUMBER() OVER (PARTITION BY demo_signup_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC) AS rn
    FROM demo_sessions
)
DELETE FROM demo_sessions d
USING ranked r
WHERE d.id = r.id
  AND r.rn > 1;

-- 2) Add a unique constraint used by the function ON CONFLICT (demo_signup_id)
ALTER TABLE demo_sessions
    ADD CONSTRAINT demo_sessions_unique_signup UNIQUE (demo_signup_id);

COMMIT;
