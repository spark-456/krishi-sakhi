-- ============================================================
-- 014_price_forecast_requests.sql
-- Prophet price forecasting module invocation log
-- directional_signal is what is communicated to the farmer
-- forecast_mape tracks model accuracy over time
-- ============================================================

CREATE TABLE IF NOT EXISTS price_forecast_requests (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id               uuid        NOT NULL REFERENCES farmers (id),
    advisory_message_id     uuid        REFERENCES advisory_messages (id),
    crop_name               text        NOT NULL,
    district                text        NOT NULL,
    forecast_horizon_days   integer     CHECK (forecast_horizon_days IN (7, 14)),
    directional_signal      text        NOT NULL CHECK (directional_signal IN ('UP','DOWN','STABLE')),
    forecast_mape           numeric     CHECK (forecast_mape >= 0),
    generated_at            timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_forecast_requests_farmer_id
    ON price_forecast_requests (farmer_id);

CREATE INDEX IF NOT EXISTS idx_price_forecast_requests_crop_district
    ON price_forecast_requests (crop_name, district);

CREATE INDEX IF NOT EXISTS idx_price_forecast_requests_generated_at
    ON price_forecast_requests (generated_at);

-- RLS
ALTER TABLE price_forecast_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "price_forecast_requests_select_own"
    ON price_forecast_requests FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "price_forecast_requests_insert_service"
    ON price_forecast_requests FOR INSERT
    TO service_role
    WITH CHECK (true);

-- UPDATE and DELETE intentionally omitted
