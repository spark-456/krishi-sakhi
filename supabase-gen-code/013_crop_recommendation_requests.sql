-- ============================================================
-- 013_crop_recommendation_requests.sql
-- Random Forest crop recommendation module invocation log
-- All 7 input features stored alongside ranked output
-- recommendation_scores: [{crop_name, confidence_score}, ...]
-- ============================================================

CREATE TABLE IF NOT EXISTS crop_recommendation_requests (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id               uuid        NOT NULL REFERENCES farmers (id),
    farm_id                 uuid        NOT NULL REFERENCES farms (id),
    advisory_message_id     uuid        REFERENCES advisory_messages (id),
    input_nitrogen          numeric,
    input_phosphorus        numeric,
    input_potassium         numeric,
    input_ph                numeric     CHECK (input_ph BETWEEN 0 AND 14),
    input_temperature       numeric,
    input_humidity          numeric     CHECK (input_humidity BETWEEN 0 AND 100),
    input_rainfall          numeric     CHECK (input_rainfall >= 0),
    top_recommendation      text        NOT NULL,
    recommendation_scores   jsonb       NOT NULL DEFAULT '[]',
    created_at              timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crop_recommendation_requests_farmer_id
    ON crop_recommendation_requests (farmer_id);

CREATE INDEX IF NOT EXISTS idx_crop_recommendation_requests_top_recommendation
    ON crop_recommendation_requests (top_recommendation);

-- RLS
ALTER TABLE crop_recommendation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crop_recommendation_requests_select_own"
    ON crop_recommendation_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "crop_recommendation_requests_insert_service"
    ON crop_recommendation_requests FOR INSERT
    TO service_role
    WITH CHECK (true);

-- UPDATE and DELETE intentionally omitted
