-- ============================================================
-- 012_pest_scans.sql
-- Pest and crop disease classification results
-- Raw images stored in Supabase Storage pest-images bucket
-- growth_stage_at_scan is a deliberate snapshot — not a live FK
-- ============================================================

CREATE TABLE IF NOT EXISTS pest_scans (
    id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id                   uuid        NOT NULL REFERENCES farmers (id),
    crop_record_id              uuid        NOT NULL REFERENCES crop_records (id),
    advisory_message_id         uuid        REFERENCES advisory_messages (id),
    storage_path                text        NOT NULL,
    predicted_pest_or_disease   text        NOT NULL,
    confidence_score            numeric     NOT NULL CHECK (confidence_score BETWEEN 0 AND 1),
    growth_stage_at_scan        text        CHECK (growth_stage_at_scan IN (
                                                'germination','vegetative',
                                                'flowering','maturity'
                                            )),
    created_at                  timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pest_scans_farmer_id
    ON pest_scans (farmer_id);

CREATE INDEX IF NOT EXISTS idx_pest_scans_crop_record_id
    ON pest_scans (crop_record_id);

-- Index for future regional outbreak detection aggregation
CREATE INDEX IF NOT EXISTS idx_pest_scans_predicted_pest_or_disease
    ON pest_scans (predicted_pest_or_disease);

-- RLS
ALTER TABLE pest_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pest_scans_select_own"
    ON pest_scans FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "pest_scans_insert_service"
    ON pest_scans FOR INSERT
    TO service_role
    WITH CHECK (true);

-- UPDATE and DELETE intentionally omitted
