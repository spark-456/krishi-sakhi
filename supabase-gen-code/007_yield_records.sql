-- ============================================================
-- 007_yield_records.sql
-- Post-harvest yield and sale data
-- One record per crop_record (enforced by UNIQUE)
-- ============================================================

CREATE TABLE IF NOT EXISTS yield_records (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_record_id      uuid        NOT NULL UNIQUE REFERENCES crop_records (id),
    farmer_id           uuid        NOT NULL REFERENCES farmers (id),
    yield_kg            numeric     CHECK (yield_kg >= 0),
    sale_price_per_kg   numeric     CHECK (sale_price_per_kg >= 0),
    sale_date           date,
    buyer_type          text        CHECK (buyer_type IN (
                                        'mandi','trader','direct',
                                        'cooperative','other'
                                    )),
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_yield_records_farmer_id
    ON yield_records (farmer_id);

-- crop_record_id already indexed by the UNIQUE constraint

-- RLS
ALTER TABLE yield_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "yield_records_select_own"
    ON yield_records FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "yield_records_insert_own"
    ON yield_records FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = farmer_id);

CREATE POLICY "yield_records_update_own"
    ON yield_records FOR UPDATE
    TO authenticated
    USING (auth.uid() = farmer_id)
    WITH CHECK (auth.uid() = farmer_id);

-- DELETE intentionally omitted
