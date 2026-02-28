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
