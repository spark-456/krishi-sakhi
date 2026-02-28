-- ============================================================
-- 002_ref_locations.sql
-- Reference table for India location hierarchy
-- Tamil Nadu and Andhra Pradesh focus
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_locations (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    state       text        NOT NULL,
    district    text        NOT NULL,
    block       text,
    village     text,

    CONSTRAINT ref_locations_state_district_block_village_unique
        UNIQUE NULLS NOT DISTINCT (state, district, block, village)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ref_locations_state_district
    ON ref_locations (state, district);

CREATE INDEX IF NOT EXISTS idx_ref_locations_district
    ON ref_locations (district);

-- RLS
ALTER TABLE ref_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_locations_select_authenticated"
    ON ref_locations FOR SELECT
    TO authenticated
    USING (true);
