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
