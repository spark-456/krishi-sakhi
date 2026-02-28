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
