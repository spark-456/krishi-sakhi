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
