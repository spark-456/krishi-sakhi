-- ============================================================
-- 003_ref_crops.sql
-- Master crop reference list with multilingual names
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_crops (
    id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_name_en    text    NOT NULL,
    crop_name_ta    text,
    crop_name_te    text,
    crop_type       text    CHECK (crop_type IN (
                                'cereal','pulse','oilseed',
                                'vegetable','fruit','spice',
                                'fibre','other'
                            )),
    typical_seasons text[],

    CONSTRAINT ref_crops_crop_name_en_unique UNIQUE (crop_name_en)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ref_crops_crop_name_en
    ON ref_crops (crop_name_en);

CREATE INDEX IF NOT EXISTS idx_ref_crops_crop_type
    ON ref_crops (crop_type);

-- RLS
ALTER TABLE ref_crops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_crops_select_authenticated"
    ON ref_crops FOR SELECT
    TO authenticated
    USING (true);
