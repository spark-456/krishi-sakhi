-- ============================================================
-- 005_farms.sql
-- Individual farm/plot records per farmer
-- soil_type is updated by the soil_scans trigger (016)
-- ============================================================

CREATE TABLE IF NOT EXISTS farms (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id       uuid        NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
    farm_name       text,
    area_acres      numeric     CHECK (area_acres > 0),
    soil_type       text        CHECK (soil_type IN (
                                    'clay','loam','sandy','red','black','alluvial'
                                )),
    irrigation_type text        CHECK (irrigation_type IN (
                                    'rainfed','canal','borewell','drip','other'
                                )),
    latitude        numeric     CHECK (latitude BETWEEN -90 AND 90),
    longitude       numeric     CHECK (longitude BETWEEN -180 AND 180),
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_farms_farmer_id
    ON farms (farmer_id);

-- RLS
ALTER TABLE farms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farms_select_own"
    ON farms FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "farms_insert_own"
    ON farms FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = farmer_id);

CREATE POLICY "farms_update_own"
    ON farms FOR UPDATE
    TO authenticated
    USING (auth.uid() = farmer_id)
    WITH CHECK (auth.uid() = farmer_id);

-- DELETE allowed only when no crop_records reference this farm
-- Enforced by the ON DELETE RESTRICT on crop_records.farm_id (see 006)
CREATE POLICY "farms_delete_own"
    ON farms FOR DELETE
    TO authenticated
    USING (auth.uid() = farmer_id);
