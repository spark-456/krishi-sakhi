BEGIN;

ALTER TABLE ref_locations ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE ref_locations ADD COLUMN IF NOT EXISTS longitude numeric;

-- Seed with approximate district centroids would go here
COMMIT;
