-- ============================================================
-- 011_soil_scans.sql
-- YOLOv8n soil classification results
-- Raw images stored in Supabase Storage soil-images bucket
-- storage_path references the S3 object
-- manually_corrected supports future agronomist review workflow
-- ============================================================

CREATE TABLE IF NOT EXISTS soil_scans (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id               uuid        NOT NULL REFERENCES farmers (id),
    farm_id                 uuid        NOT NULL REFERENCES farms (id),
    advisory_message_id     uuid        REFERENCES advisory_messages (id),
    storage_path            text        NOT NULL,
    predicted_soil_class    text        NOT NULL CHECK (predicted_soil_class IN (
                                            'clay','loam','sandy','red','black','alluvial'
                                        )),
    confidence_score        numeric     NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    manually_corrected      boolean     NOT NULL DEFAULT false,
    corrected_soil_class    text        CHECK (corrected_soil_class IN (
                                            'clay','loam','sandy','red','black','alluvial'
                                        )),
    created_at              timestamptz NOT NULL DEFAULT now(),

    -- corrected_soil_class must be set when manually_corrected is true
    CONSTRAINT soil_scans_correction_consistency
        CHECK (
            manually_corrected = false
            OR corrected_soil_class IS NOT NULL
        )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_soil_scans_farmer_id
    ON soil_scans (farmer_id);

CREATE INDEX IF NOT EXISTS idx_soil_scans_farm_id
    ON soil_scans (farm_id);

CREATE INDEX IF NOT EXISTS idx_soil_scans_manually_corrected
    ON soil_scans (manually_corrected)
    WHERE manually_corrected = true;

-- RLS
ALTER TABLE soil_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soil_scans_select_own"
    ON soil_scans FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "soil_scans_insert_service"
    ON soil_scans FOR INSERT
    TO service_role
    WITH CHECK (true);

CREATE POLICY "soil_scans_update_service"
    ON soil_scans FOR UPDATE
    TO service_role
    USING (true);

-- DELETE intentionally omitted — training data is permanent
