-- ============================================================
-- Krishi Sakhi — Complete Supabase Schema
-- Single-file deployment: run this entire file in the
-- Supabase SQL Editor or via psql against your project.
-- Migrations are ordered to satisfy all FK dependencies.
-- Safe to inspect section by section using the file markers.
-- ============================================================



-- ============================================================
-- 001_enable_extensions.sql
-- Enable required PostgreSQL extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";



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



-- ============================================================
-- 004_farmers.sql
-- Core farmer profile table
-- id mirrors auth.users.id — one row per registered farmer
-- ============================================================

CREATE TABLE IF NOT EXISTS farmers (
    id                      uuid        PRIMARY KEY
                                        REFERENCES auth.users (id) ON DELETE CASCADE,
    full_name               text        NOT NULL,
    preferred_language      text        NOT NULL DEFAULT 'english'
                                        CHECK (preferred_language IN ('english','tamil','telugu')),
    state                   text        NOT NULL,
    district                text        NOT NULL,
    block                   text,
    village                 text,
    onboarding_complete     boolean     NOT NULL DEFAULT false,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_farmers_district
    ON farmers (district);

-- updated_at auto-update trigger
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_farmers_updated_at
    BEFORE UPDATE ON farmers
    FOR EACH ROW
    EXECUTE FUNCTION fn_set_updated_at();

-- RLS
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "farmers_select_own"
    ON farmers FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY "farmers_insert_own"
    ON farmers FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "farmers_update_own"
    ON farmers FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- DELETE is intentionally omitted — farmer profiles cannot be deleted
-- through the application layer



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



-- ============================================================
-- 008_expense_logs.sql
-- Line-item farming expense entries per crop record
-- Summarised by FastAPI context assembler for advisory context
-- ============================================================

CREATE TABLE IF NOT EXISTS expense_logs (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    crop_record_id  uuid        NOT NULL REFERENCES crop_records (id) ON DELETE RESTRICT,
    farmer_id       uuid        NOT NULL REFERENCES farmers (id),
    category        text        NOT NULL CHECK (category IN (
                                    'seeds','fertilizer','pesticide',
                                    'labour','irrigation','equipment','other'
                                )),
    amount_inr      numeric     NOT NULL CHECK (amount_inr > 0),
    expense_date    date        NOT NULL,
    notes           text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_expense_logs_farmer_id
    ON expense_logs (farmer_id);

CREATE INDEX IF NOT EXISTS idx_expense_logs_crop_record_id
    ON expense_logs (crop_record_id);

-- expense_date index for time-range summaries in context assembly
CREATE INDEX IF NOT EXISTS idx_expense_logs_expense_date
    ON expense_logs (expense_date);

-- RLS
ALTER TABLE expense_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expense_logs_select_own"
    ON expense_logs FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "expense_logs_insert_own"
    ON expense_logs FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = farmer_id);

CREATE POLICY "expense_logs_update_own"
    ON expense_logs FOR UPDATE
    TO authenticated
    USING (auth.uid() = farmer_id)
    WITH CHECK (auth.uid() = farmer_id);

-- DELETE allowed — farmers may correct erroneous entries
CREATE POLICY "expense_logs_delete_own"
    ON expense_logs FOR DELETE
    TO authenticated
    USING (auth.uid() = farmer_id);



-- ============================================================
-- 009_advisory_sessions.sql
-- Groups advisory message turns into sessions
-- crop_record_id is a snapshot of active crop at session start
-- total_turns incremented by trigger in 016_triggers.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS advisory_sessions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id       uuid        NOT NULL REFERENCES farmers (id),
    crop_record_id  uuid        REFERENCES crop_records (id),
    started_at      timestamptz NOT NULL DEFAULT now(),
    ended_at        timestamptz,
    total_turns     integer     NOT NULL DEFAULT 0,

    CONSTRAINT advisory_sessions_ended_after_started
        CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_advisory_sessions_farmer_id
    ON advisory_sessions (farmer_id);

CREATE INDEX IF NOT EXISTS idx_advisory_sessions_started_at
    ON advisory_sessions (started_at);

-- RLS
ALTER TABLE advisory_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advisory_sessions_select_own"
    ON advisory_sessions FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

CREATE POLICY "advisory_sessions_insert_own"
    ON advisory_sessions FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = farmer_id);

-- UPDATE allowed only to set ended_at — enforced at app layer
CREATE POLICY "advisory_sessions_update_own"
    ON advisory_sessions FOR UPDATE
    TO authenticated
    USING (auth.uid() = farmer_id)
    WITH CHECK (auth.uid() = farmer_id);

-- DELETE intentionally omitted



-- ============================================================
-- 010_advisory_messages.sql
-- Individual advisory turns — the most important table
-- Every query and response is recorded with full audit data
-- context_block_sent and retrieved_chunk_ids must ALWAYS be
-- populated — never null on insert
-- ============================================================

CREATE TABLE IF NOT EXISTS advisory_messages (
    id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id              uuid        NOT NULL REFERENCES advisory_sessions (id),
    farmer_id               uuid        NOT NULL REFERENCES farmers (id),
    input_channel           text        NOT NULL CHECK (input_channel IN ('text','voice','image')),
    farmer_input_text       text        NOT NULL,
    whisper_confidence      numeric     CHECK (
                                            whisper_confidence IS NULL
                                            OR whisper_confidence BETWEEN 0 AND 1
                                        ),
    context_block_sent      jsonb       NOT NULL,
    retrieved_chunk_ids     text[]      NOT NULL DEFAULT '{}',
    response_text           text        NOT NULL,
    was_deferred_to_kvk     boolean     NOT NULL DEFAULT false,
    response_latency_ms     integer,
    created_at              timestamptz NOT NULL DEFAULT now(),

    -- whisper_confidence must be null when channel is text
    CONSTRAINT advisory_messages_whisper_only_for_voice
        CHECK (
            input_channel = 'voice' OR whisper_confidence IS NULL
        )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_advisory_messages_farmer_id
    ON advisory_messages (farmer_id);

CREATE INDEX IF NOT EXISTS idx_advisory_messages_session_id
    ON advisory_messages (session_id);

CREATE INDEX IF NOT EXISTS idx_advisory_messages_created_at
    ON advisory_messages (created_at);

CREATE INDEX IF NOT EXISTS idx_advisory_messages_was_deferred_to_kvk
    ON advisory_messages (was_deferred_to_kvk)
    WHERE was_deferred_to_kvk = true;

-- RLS
ALTER TABLE advisory_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "advisory_messages_select_own"
    ON advisory_messages FOR SELECT
    TO authenticated
    USING (auth.uid() = farmer_id);

-- INSERT via service role only (FastAPI backend writes this)
-- Farmers do not insert directly
CREATE POLICY "advisory_messages_insert_service"
    ON advisory_messages FOR INSERT
    TO service_role
    WITH CHECK (true);

-- UPDATE and DELETE intentionally omitted — immutable audit record



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



-- ============================================================
-- 015_ref_knowledge_documents.sql
-- Registry of documents ingested into the Dify RAG knowledge base
-- Does NOT store the documents or embeddings — those live in Dify/FAISS
-- Metadata tags here must exactly match the tags set in Dify
-- ============================================================

CREATE TABLE IF NOT EXISTS ref_knowledge_documents (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    document_name   text        NOT NULL UNIQUE,
    topic_category  text        CHECK (topic_category IN (
                                    'pest','irrigation','soil','market',
                                    'crop_planning','weather','general'
                                )),
    region_tag      text,
    crop_tag        text,
    season_tag      text        CHECK (season_tag IN ('kharif','rabi','zaid','all')),
    ingested_at     timestamptz,
    chunk_count     integer     CHECK (chunk_count > 0)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ref_knowledge_documents_topic_category
    ON ref_knowledge_documents (topic_category);

CREATE INDEX IF NOT EXISTS idx_ref_knowledge_documents_region_tag
    ON ref_knowledge_documents (region_tag);

-- RLS
ALTER TABLE ref_knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ref_knowledge_documents_select_authenticated"
    ON ref_knowledge_documents FOR SELECT
    TO authenticated
    USING (true);



-- ============================================================
-- 016_triggers.sql
-- All triggers defined after all tables exist
-- Three triggers:
--   1. fn_set_updated_at        — already created in 004_farmers.sql
--      Applied also to crop_records
--   2. trg_increment_total_turns — increments session turn counter
--   3. trg_soil_scan_updates_farm — syncs soil_type back to farms
-- ============================================================


-- -------------------------------------------------------
-- 1. updated_at trigger on crop_records
--    fn_set_updated_at() was already created in 004_farmers.sql
-- -------------------------------------------------------
-- (trigger already created in 006_crop_records.sql — no duplicate needed)


-- -------------------------------------------------------
-- 2. Increment advisory_sessions.total_turns
--    Fires after each new advisory_message insert
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_increment_session_total_turns()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE advisory_sessions
    SET total_turns = total_turns + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_increment_total_turns
    AFTER INSERT ON advisory_messages
    FOR EACH ROW
    EXECUTE FUNCTION fn_increment_session_total_turns();


-- -------------------------------------------------------
-- 3. Sync farms.soil_type after a new soil_scan is inserted
--    Only fires when manually_corrected = false (i.e. fresh scan)
--    Does not overwrite if the scan was a manual correction insert
--    Manual corrections update farms.soil_type via the update path
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_soil_scan_update_farm()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.manually_corrected = false THEN
        UPDATE farms
        SET soil_type = NEW.predicted_soil_class
        WHERE id = NEW.farm_id;
    ELSE
        -- Manual correction: use corrected_soil_class instead
        UPDATE farms
        SET soil_type = NEW.corrected_soil_class
        WHERE id = NEW.farm_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_soil_scan_updates_farm
    AFTER INSERT ON soil_scans
    FOR EACH ROW
    EXECUTE FUNCTION fn_soil_scan_update_farm();

-- Also fire on UPDATE to soil_scans (for manual correction workflow)
CREATE TRIGGER trg_soil_scan_correction_updates_farm
    AFTER UPDATE OF manually_corrected, corrected_soil_class ON soil_scans
    FOR EACH ROW
    WHEN (NEW.manually_corrected = true AND NEW.corrected_soil_class IS NOT NULL)
    EXECUTE FUNCTION fn_soil_scan_update_farm();



-- ============================================================
-- 017_storage_buckets.sql
-- Supabase Storage bucket creation and storage-level RLS
-- Two buckets only: soil-images and pest-images
-- Voice audio is NEVER stored — not in any bucket
-- ============================================================


-- -------------------------------------------------------
-- Create buckets
-- public = false on both — no public URLs ever
-- -------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    (
        'soil-images',
        'soil-images',
        false,
        10485760, -- 10MB in bytes
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    ),
    (
        'pest-images',
        'pest-images',
        false,
        10485760, -- 10MB in bytes
        ARRAY['image/jpeg', 'image/png', 'image/webp']
    )
ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------
-- Storage RLS: soil-images bucket
-- Path convention: {farmer_id}/{farm_id}/{unix_timestamp}.jpg
-- Farmers can only access objects where path starts with their own uid
-- -------------------------------------------------------
CREATE POLICY "soil_images_select_own"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'soil-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "soil_images_insert_own"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'soil-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- UPDATE and DELETE disabled on soil-images — training data is permanent
-- Service role retains full access implicitly


-- -------------------------------------------------------
-- Storage RLS: pest-images bucket
-- Path convention: {farmer_id}/{crop_record_id}/{unix_timestamp}.jpg
-- -------------------------------------------------------
CREATE POLICY "pest_images_select_own"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'pest-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

CREATE POLICY "pest_images_insert_own"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'pest-images'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- UPDATE and DELETE disabled on pest-images



-- ============================================================
-- 018_seed_ref_data.sql
-- Seed data for reference tables
-- ref_crops: common crops in Tamil Nadu and Andhra Pradesh
-- ref_locations: district-level seed for TN and AP
-- Run once on fresh instance — safe to re-run (ON CONFLICT DO NOTHING)
-- ============================================================


-- -------------------------------------------------------
-- ref_crops seed
-- -------------------------------------------------------
INSERT INTO ref_crops (crop_name_en, crop_name_ta, crop_name_te, crop_type, typical_seasons)
VALUES
    ('Paddy',           'நெல்',         'వరి',          'cereal',   ARRAY['kharif','rabi']),
    ('Wheat',           'கோதுமை',       'గోధుమ',        'cereal',   ARRAY['rabi']),
    ('Maize',           'மக்காச்சோளம்', 'మొక్కజొన్న',    'cereal',   ARRAY['kharif','rabi']),
    ('Sorghum',         'சோளம்',        'జొన్న',         'cereal',   ARRAY['kharif','rabi']),
    ('Pearl Millet',    'கம்பு',        'సజ్జ',          'cereal',   ARRAY['kharif']),
    ('Finger Millet',   'கேழ்வரகு',    'రాగి',          'cereal',   ARRAY['kharif']),
    ('Chickpea',        'கொண்டைக்கடலை','శనగ',           'pulse',    ARRAY['rabi']),
    ('Pigeon Pea',      'துவரம்பருப்பு','కందులు',        'pulse',    ARRAY['kharif']),
    ('Black Gram',      'உளுந்து',      'మినుములు',     'pulse',    ARRAY['kharif','rabi']),
    ('Green Gram',      'பயறு',         'పెసలు',         'pulse',    ARRAY['kharif','rabi']),
    ('Groundnut',       'நிலக்கடலை',   'వేరుశెనగ',     'oilseed',  ARRAY['kharif','rabi']),
    ('Sunflower',       'சூரியகாந்தி', 'పొద్దుతిరుగుడు','oilseed',  ARRAY['kharif','rabi']),
    ('Sesame',          'எள்',          'నువ్వులు',      'oilseed',  ARRAY['kharif']),
    ('Castor',          'ஆமணக்கு',     'ఆముదం',         'oilseed',  ARRAY['kharif']),
    ('Cotton',          'பருத்தி',      'పత్తి',         'fibre',    ARRAY['kharif']),
    ('Sugarcane',       'கரும்பு',      'చెరకు',         'cereal',   ARRAY['kharif','rabi','zaid']),
    ('Banana',          'வாழை',         'అరటి',          'fruit',    ARRAY['kharif','rabi','zaid']),
    ('Mango',           'மாம்பழம்',    'మామిడి',        'fruit',    ARRAY['kharif']),
    ('Tomato',          'தக்காளி',      'టమాట',          'vegetable',ARRAY['kharif','rabi','zaid']),
    ('Onion',           'வெங்காயம்',   'ఉల్లిపాయ',     'vegetable',ARRAY['kharif','rabi']),
    ('Chilli',          'மிளகாய்',      'మిర్చి',        'spice',    ARRAY['kharif','rabi']),
    ('Turmeric',        'மஞ்சள்',       'పసుపు',         'spice',    ARRAY['kharif'])
ON CONFLICT (crop_name_en) DO NOTHING;


-- -------------------------------------------------------
-- ref_locations seed — Tamil Nadu districts
-- -------------------------------------------------------
INSERT INTO ref_locations (state, district)
VALUES
    ('Tamil Nadu', 'Ariyalur'),
    ('Tamil Nadu', 'Chengalpattu'),
    ('Tamil Nadu', 'Chennai'),
    ('Tamil Nadu', 'Coimbatore'),
    ('Tamil Nadu', 'Cuddalore'),
    ('Tamil Nadu', 'Dharmapuri'),
    ('Tamil Nadu', 'Dindigul'),
    ('Tamil Nadu', 'Erode'),
    ('Tamil Nadu', 'Kallakurichi'),
    ('Tamil Nadu', 'Kanchipuram'),
    ('Tamil Nadu', 'Kanyakumari'),
    ('Tamil Nadu', 'Karur'),
    ('Tamil Nadu', 'Krishnagiri'),
    ('Tamil Nadu', 'Madurai'),
    ('Tamil Nadu', 'Mayiladuthurai'),
    ('Tamil Nadu', 'Nagapattinam'),
    ('Tamil Nadu', 'Namakkal'),
    ('Tamil Nadu', 'Nilgiris'),
    ('Tamil Nadu', 'Perambalur'),
    ('Tamil Nadu', 'Pudukkottai'),
    ('Tamil Nadu', 'Ramanathapuram'),
    ('Tamil Nadu', 'Ranipet'),
    ('Tamil Nadu', 'Salem'),
    ('Tamil Nadu', 'Sivaganga'),
    ('Tamil Nadu', 'Tenkasi'),
    ('Tamil Nadu', 'Thanjavur'),
    ('Tamil Nadu', 'Theni'),
    ('Tamil Nadu', 'Thoothukudi'),
    ('Tamil Nadu', 'Tiruchirappalli'),
    ('Tamil Nadu', 'Tirunelveli'),
    ('Tamil Nadu', 'Tirupattur'),
    ('Tamil Nadu', 'Tiruppur'),
    ('Tamil Nadu', 'Tiruvallur'),
    ('Tamil Nadu', 'Tiruvannamalai'),
    ('Tamil Nadu', 'Tiruvarur'),
    ('Tamil Nadu', 'Vellore'),
    ('Tamil Nadu', 'Viluppuram'),
    ('Tamil Nadu', 'Virudhunagar')
ON CONFLICT DO NOTHING;


-- -------------------------------------------------------
-- ref_locations seed — Andhra Pradesh districts
-- -------------------------------------------------------
INSERT INTO ref_locations (state, district)
VALUES
    ('Andhra Pradesh', 'Alluri Sitharama Raju'),
    ('Andhra Pradesh', 'Anakapalli'),
    ('Andhra Pradesh', 'Anantapur'),
    ('Andhra Pradesh', 'Annamayya'),
    ('Andhra Pradesh', 'Bapatla'),
    ('Andhra Pradesh', 'Chittoor'),
    ('Andhra Pradesh', 'Dr. B.R. Ambedkar Konaseema'),
    ('Andhra Pradesh', 'East Godavari'),
    ('Andhra Pradesh', 'Eluru'),
    ('Andhra Pradesh', 'Guntur'),
    ('Andhra Pradesh', 'Kakinada'),
    ('Andhra Pradesh', 'Krishna'),
    ('Andhra Pradesh', 'Kurnool'),
    ('Andhra Pradesh', 'Nandyal'),
    ('Andhra Pradesh', 'NTR'),
    ('Andhra Pradesh', 'Palnadu'),
    ('Andhra Pradesh', 'Parvathipuram Manyam'),
    ('Andhra Pradesh', 'Prakasam'),
    ('Andhra Pradesh', 'Sri Potti Sriramulu Nellore'),
    ('Andhra Pradesh', 'Sri Sathya Sai'),
    ('Andhra Pradesh', 'Srikakulam'),
    ('Andhra Pradesh', 'Tirupati'),
    ('Andhra Pradesh', 'Visakhapatnam'),
    ('Andhra Pradesh', 'Vizianagaram'),
    ('Andhra Pradesh', 'West Godavari'),
    ('Andhra Pradesh', 'YSR Kadapa')
ON CONFLICT DO NOTHING;

