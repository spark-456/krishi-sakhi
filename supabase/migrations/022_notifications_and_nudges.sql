BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    farmer_id       uuid        NOT NULL REFERENCES farmers (id) ON DELETE CASCADE,
    title           text        NOT NULL,
    message         text        NOT NULL,
    type            text        NOT NULL DEFAULT 'info',
    is_read         boolean     NOT NULL DEFAULT false,
    action_url      text,
    metadata        jsonb       NOT NULL DEFAULT '{}'::jsonb,
    dedupe_key      text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_farmer_created
    ON notifications (farmer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_farmer_unread
    ON notifications (farmer_id, is_read, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_farmer_dedupe
    ON notifications (farmer_id, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'notifications_select_own') THEN
        CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
            TO authenticated USING (auth.uid() = farmer_id);
    END IF;

    IF NOT EXISTS (SELECT FROM pg_policies WHERE policyname = 'notifications_update_own') THEN
        CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
            TO authenticated USING (auth.uid() = farmer_id)
            WITH CHECK (auth.uid() = farmer_id);
    END IF;

END $$;

COMMIT;
