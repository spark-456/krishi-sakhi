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
