-- ============================================================
-- 006_crop_records.sql
-- Active and historical crop records per farm
-- Partial unique index enforces one active crop per farm
-- farmer_id is denormalised for fast context assembly
-- ============================================================

CREATE TABLE IF NOT EXISTS crop_records (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farm_id                 uuid        NOT NULL REFERENCES farms (id) ON DELETE RESTRICT,
    farmer_id               uuid        NOT NULL REFERENCES farmers (id),
    crop_name               text        NOT NULL,
    season                  text        NOT NULL CHECK (season IN ('kharif','rabi','zaid')),
    sowing_date             date,
    expected_harvest_date   date,
    actual_harvest_date     date,
    growth_stage            text        CHECK (growth_stage IN (
                                            'germination','vegetative',
                                            'flowering','maturity','post-harvest'
                                        )),
    status                  text        NOT NULL DEFAULT 'active'
                                        CHECK (status IN ('active','harvested','abandoned')),
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one active crop per farm at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_crop_records_one_active_per_farm
    ON crop_records (farm_id)
    WHERE status = 'active';

-- General indexes
CREATE INDEX IF NOT EXISTS idx_crop_records_farmer_id
    ON crop_records (farmer_id);

CREATE INDEX IF NOT EXISTS idx_crop_records_farm_id
    ON crop_records (farm_id);

CREATE INDEX IF NOT EXISTS idx_crop_records_status
    ON crop_records (status);

-- updated_at trigger
CREATE TRIGGER trg_crop_records_updated_at
    BEFORE UPDATE ON crop_records
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- RLS
ALTER TABLE crop_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crop_records_select_own"
    ON crop_records FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "crop_records_insert_own"
    ON crop_records FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = farmer_id);

CREATE POLICY "crop_records_update_own"
    ON crop_records FOR UPDATE
    TO authenticated
    USING (auth.uid() = farmer_id)
    WITH CHECK (auth.uid() = farmer_id);

-- DELETE intentionally omitted — crop records are permanent history
