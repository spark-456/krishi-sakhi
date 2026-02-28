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
