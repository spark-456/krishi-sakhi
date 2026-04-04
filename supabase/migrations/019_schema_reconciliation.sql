BEGIN;

-- 1. Create activity_logs as a new tracked table
CREATE TABLE IF NOT EXISTS activity_logs (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id       uuid        NOT NULL REFERENCES farmers (id),
    farm_id         uuid        REFERENCES farms (id),
    crop_name       text,
    activity_type   text        NOT NULL CHECK (activity_type IN (
                                    'planting','irrigation','fertilizer','pesticide',
                                    'weeding','pruning','harvest','soil_test',
                                    'disease_alert','growth_update','other'
                                )),
    title           text        NOT NULL,
    description     text,
    date            date        NOT NULL DEFAULT CURRENT_DATE,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_farmer_id ON activity_logs (farmer_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_farm_id ON activity_logs (farm_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_date ON activity_logs (date);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'activity_logs_select_own') THEN
        CREATE POLICY "activity_logs_select_own" ON activity_logs FOR SELECT
            TO authenticated USING (auth.uid() = farmer_id);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'activity_logs_insert_own') THEN
        CREATE POLICY "activity_logs_insert_own" ON activity_logs FOR INSERT
            TO authenticated WITH CHECK (auth.uid() = farmer_id);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'activity_logs_update_own') THEN
        CREATE POLICY "activity_logs_update_own" ON activity_logs FOR UPDATE
            TO authenticated USING (auth.uid() = farmer_id);
    END IF;
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'activity_logs_delete_own') THEN
        CREATE POLICY "activity_logs_delete_own" ON activity_logs FOR DELETE
            TO authenticated USING (auth.uid() = farmer_id);
    END IF;
END $$;

-- 2. Extend crop_records growth_stage CHECK to include frontend values:
ALTER TABLE crop_records DROP CONSTRAINT IF EXISTS crop_records_growth_stage_check;
ALTER TABLE crop_records ADD CONSTRAINT crop_records_growth_stage_check
    CHECK (growth_stage IN (
        'land_prep','germination','sowing','vegetative',
        'flowering','fruiting','maturity','harvest','post-harvest','post_harvest'
    ));

-- 3. Note: phone_number added to farmers previously (tech debt for auth workaround)
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS phone_number text;

COMMIT;
