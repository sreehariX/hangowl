-- Add precise geo coordinates to plans so Google Maps can navigate to the
-- exact spot a creator pinned (e.g. a specific dhaba entrance, a bench on
-- Main Gate road) instead of just the hostel label. Nullable because legacy
-- plans and cases where the creator doesn't pin still have the text label.

ALTER TABLE plans ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS longitude double precision;

-- Sanity bounds: if any value is present, it must be a valid WGS84 coordinate.
ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_latitude_range;
ALTER TABLE plans
  ADD CONSTRAINT plans_latitude_range
  CHECK (latitude IS NULL OR (latitude BETWEEN -90 AND 90));

ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_longitude_range;
ALTER TABLE plans
  ADD CONSTRAINT plans_longitude_range
  CHECK (longitude IS NULL OR (longitude BETWEEN -180 AND 180));

-- Either both set or both null -- a lone axis is always a bug.
ALTER TABLE plans
  DROP CONSTRAINT IF EXISTS plans_lat_lng_paired;
ALTER TABLE plans
  ADD CONSTRAINT plans_lat_lng_paired
  CHECK ((latitude IS NULL) = (longitude IS NULL));
