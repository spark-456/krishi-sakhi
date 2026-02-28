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
