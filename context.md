# Krishi Sakhi — Agent Context Document
> This document is the single source of truth for any AI agent, developer, or automated system working on the Krishi Sakhi project. Read this fully before writing any code, making any schema changes, calling any API, or generating any file. Do not infer project structure from conventions alone — defer to this document.

---

## 1. Project Identity

**Name:** Krishi Sakhi ("Farmer's Friend" in Hindi)
**Type:** Agricultural Decision Support Platform
**Target User:** Smallholder farmers in Tamil Nadu and Andhra Pradesh, India
**Primary Interface:** Progressive Web Application (PWA), mobile-first, installable on Android without Play Store
**Deployment Model:** Primary models via Cloud API with completely self-hosted local fallback (Docker Compose, CPU-only) for high availability
**Current Stage:** Research prototype — evaluated, not yet in field trial

**The problem being solved:** India's extension worker-to-farmer ratio has fallen below 1:5,000. The majority of smallholder farmers make high-stakes crop, pest, irrigation, and market decisions without any structured expert guidance. Accessing even nominally available public extension services requires travel, time off the farm, and opportunity cost that makes them practically inaccessible. Krishi Sakhi replaces fragmented, inaccessible advisory with a single grounded AI-assisted interface that works on low-end smartphones under intermittent connectivity.

---

## 2. System Architecture

The system is composed of three loosely coupled layers. Every agent working on this project must understand all three layers even if their task only touches one.

### 2.1 Layer 1 — Client (PWA)
- **Framework:** React + Vite
- **Installable on Android** without Play Store dependency
- **Input modalities:** Text chat, voice note (browser MediaRecorder API), image upload (camera or gallery)
- **Offline support:** Service worker caches the application shell; deferred sync when connectivity restores
- **Key screens:** Farmer onboarding, Ask Sakhi (conversational advisory), Farm Records, Expense Log
- **Auth:** Supabase JWT tokens — phone number is the primary login method (not email; rural users do not reliably have email)
- **Language:** English UI currently; Tamil and Telugu are planned future work

### 2.2 Layer 2 — Advisory (Dify)
- **Dify Community Edition** (self-hosted via Docker) is the RAG agent, connected directly to the FastAPI backend via HTTP API
  - Knowledge base: curated agricultural documents chunked into 300–500 token segments
  - Embeddings: `nomic-embed-text` via Ollama
  - Retrieval: FAISS vector search with metadata-filtered top-k (filters: region, crop, season, topic category)
  - LLM: **Cloud LLM API** (e.g., Groq, OpenAI) is the primary model, with local **Llama 3.1 8B** via Ollama acting as a fallback
- **Request flow:** FastAPI assembles farmer context → POSTs directly to Dify Chat API → Dify performs RAG + LLM generation → returns response to FastAPI
- **Safety constraints:** the advisory layer has explicit policy guardrails — it will refuse specific pesticide dosages, financial predictions, and non-agricultural advice, and defer to Krishi Vigyan Kendra (KVK) for unsafe queries

### 2.3 Layer 3 — Backend and Data (FastAPI + Supabase)
- **FastAPI** manages: authentication, request routing, farmer context assembly, ML tool invocation, response logging
- **Supabase PostgreSQL** stores all structured data (see Section 5 for full schema)
- **Supabase Storage (S3-compatible)** stores binary files — soil images and pest images only (see Section 6)
- **Supabase Auth** handles JWT issuance; phone-based OTP is the login flow
- **Row Level Security (RLS)** is enabled on all tables and all storage buckets — farmers can only access their own data

---

## 3. ML Microservices

Each ML module is deployed as an independent FastAPI microservice. They are called by the main FastAPI backend and their structured outputs are appended to the farmer context block before it is sent to Dify. Agents must never treat these as monolithic — they are independently replaceable.

### 3.1 Soil Classification
- **Model:** YOLOv8n (classification mode)
- **Input:** Soil surface image uploaded by farmer
- **Output:** Predicted soil class + confidence score
- **Classes:** clay, loam, sandy, red, black, alluvial
- **Storage:** Raw image saved to Supabase S3 `soil-images` bucket; result written to `soil_scans` table
- **Post-processing:** `farms.soil_type` is updated with the predicted class
- **Retraining note:** Images must be retained long-term — every farmer upload is a real-world training sample

### 3.2 Crop Recommendation
- **Model:** Random Forest classifier
- **Input:** NPK values (nitrogen, phosphorus, potassium), temperature, humidity, rainfall, pH
- **Output:** Ranked list of recommended crops with confidence scores
- **Dataset:** Crop Recommendation Dataset (22 crop classes, publicly available)
- **Storage:** No file storage; inputs and outputs written to `crop_recommendation_requests` table

### 3.3 Season Detection
- **Model:** Rule-based + lightweight classifier
- **Input:** Current date + farmer location (district)
- **Output:** Detected season (Kharif / Rabi / Zaid) with confidence
- **Storage:** Result used in context assembly; not persisted separately

### 3.4 Price Forecasting
- **Model:** Prophet (Facebook/Meta time-series forecasting)
- **Input:** Historical district-level mandi price data from data.gov.in
- **Output:** 7–14 day directional signal (UP / DOWN / STABLE) + MAPE
- **Storage:** Request and result written to `price_forecast_requests` table

### 3.5 Voice Transcription
- **Model:** Whisper base (74M parameters), served locally
- **Input:** Audio blob from browser MediaRecorder API
- **Output:** Transcribed text string + confidence score
- **Storage:** Audio file is NEVER persisted. Processed in memory, discarded immediately after transcription. Transcription text stored in `advisory_messages.farmer_input_text`

---

## 4. Request Data Flow

This is the exact sequence for a single farmer query. Every agent touching the backend must preserve this flow.

```
1. Farmer submits input via PWA
   └── Text → enters pipeline directly
   └── Voice → sent to Whisper microservice → transcribed → audio discarded → text enters pipeline
   └── Image → sent to relevant ML microservice (soil or pest) → result appended to context

2. FastAPI assembles farmer context block:
   └── farmers table: name, language, location (district)
   └── farms table: area, soil_type, irrigation_type
   └── crop_records table: active crop, season, growth_stage, sowing_date
   └── expense_logs table: recent entries summarised
   └── Open-Meteo API: live weather for farmer's district
   └── ML microservice output (if image was uploaded)

3. FastAPI POSTs directly to Dify Chat API with:
   └── farmer_input_text
   └── assembled context block (JSON) injected as conversation variables
   └── pre-computed ML outputs

4. Dify RAG agent:
   └── Performs FAISS vector search with metadata filters
   └── Cloud LLM (or local Llama fallback) generates grounded response using retrieved chunks
   └── Safety guardrails evaluated

5. Dify returns response directly to FastAPI

6. FastAPI:
   └── Returns response to PWA
   └── Writes full record to advisory_messages (input, context block, chunk IDs, response, latency, KVK flag)
   └── Writes to price_forecast_requests or crop_recommendation_requests if those modules ran
   └── Increments advisory_sessions.total_turns
```

**Critical rule for agents:** The context assembly in step 2 must be completable in a single fast database query path. Do not add deep nesting or cross-table joins that would slow this down. The farmer must not wait more than ~2 seconds (P50 target) for a response.

---

## 5. Database Schema (Supabase PostgreSQL)

All tables use `uuid` primary keys generated by `gen_random_uuid()`. All tables have `created_at timestamptz` defaulting to `now()`. RLS is enabled on every table.

### 5.1 Auth Domain
`auth.users` is managed by Supabase Auth. Do not create or modify this table. All other tables reference `auth.users.id` as `user_id` or `farmer_id`.

---

### 5.2 Farmer Profile Domain

**Table: `farmers`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK, FK → auth.users.id | |
| full_name | text | NOT NULL | |
| preferred_language | text | DEFAULT 'english' | 'english', 'tamil', 'telugu' |
| state | text | NOT NULL | |
| district | text | NOT NULL | Drives mandi price filter and RAG metadata filter |
| block | text | | |
| village | text | | |
| onboarding_complete | boolean | DEFAULT false | PWA onboarding flow completion flag |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Table: `farms`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| farm_name | text | | Farmer-assigned label e.g. "North Plot" |
| area_acres | numeric | | |
| soil_type | text | | Updated by soil_scans module output |
| irrigation_type | text | | 'rainfed', 'canal', 'borewell', 'drip' |
| latitude | numeric | | Optional GPS |
| longitude | numeric | | Optional GPS |
| created_at | timestamptz | DEFAULT now() | |

---

### 5.3 Crop Management Domain

**Table: `crop_records`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| farm_id | uuid | FK → farms.id, NOT NULL | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | Denormalised for fast context assembly — do not remove |
| crop_name | text | NOT NULL | |
| season | text | NOT NULL | 'kharif', 'rabi', 'zaid' |
| sowing_date | date | | |
| expected_harvest_date | date | | |
| actual_harvest_date | date | | Null until harvested |
| growth_stage | text | | 'germination', 'vegetative', 'flowering', 'maturity' |
| status | text | DEFAULT 'active' | 'active', 'harvested', 'abandoned' |
| created_at | timestamptz | DEFAULT now() | |
| updated_at | timestamptz | DEFAULT now() | |

**Table: `yield_records`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| crop_record_id | uuid | FK → crop_records.id, NOT NULL | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| yield_kg | numeric | | Actual harvested quantity |
| sale_price_per_kg | numeric | | Price farmer received |
| sale_date | date | | |
| buyer_type | text | | 'mandi', 'trader', 'direct', 'cooperative' |
| notes | text | | |
| created_at | timestamptz | DEFAULT now() | |

---

### 5.4 Expense Domain

**Table: `expense_logs`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| crop_record_id | uuid | FK → crop_records.id, NOT NULL | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| category | text | NOT NULL | 'seeds', 'fertilizer', 'pesticide', 'labour', 'irrigation', 'equipment', 'other' |
| amount_inr | numeric | NOT NULL | |
| expense_date | date | NOT NULL | |
| notes | text | | |
| created_at | timestamptz | DEFAULT now() | |

---

### 5.5 Advisory Domain

**Table: `advisory_sessions`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| crop_record_id | uuid | FK → crop_records.id | Active crop at session start — nullable if no active crop |
| started_at | timestamptz | DEFAULT now() | |
| ended_at | timestamptz | | Null if session still open |
| total_turns | integer | DEFAULT 0 | Incremented on each message |

**Table: `advisory_messages`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| session_id | uuid | FK → advisory_sessions.id, NOT NULL | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| input_channel | text | NOT NULL | 'text', 'voice', 'image' |
| farmer_input_text | text | NOT NULL | Raw typed text OR Whisper transcription |
| whisper_confidence | numeric | | Null if input_channel = 'text' |
| context_block_sent | jsonb | | Full assembled context payload sent to Dify — stored for audit |
| retrieved_chunk_ids | text[] | | Array of Dify chunk reference IDs used in response generation |
| response_text | text | NOT NULL | Final advisory response returned to farmer |
| was_deferred_to_kvk | boolean | DEFAULT false | True if safety guardrail triggered KVK deferral |
| response_latency_ms | integer | | End-to-end latency for this turn |
| created_at | timestamptz | DEFAULT now() | |

---

### 5.6 ML Outputs Domain

**Table: `soil_scans`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| farm_id | uuid | FK → farms.id, NOT NULL | |
| advisory_message_id | uuid | FK → advisory_messages.id | The message turn that triggered this scan |
| storage_path | text | NOT NULL | Path in Supabase S3 soil-images bucket |
| predicted_soil_class | text | NOT NULL | 'clay', 'loam', 'sandy', 'red', 'black', 'alluvial' |
| confidence_score | numeric | NOT NULL | YOLOv8n output confidence 0–1 |
| manually_corrected | boolean | DEFAULT false | Set true if agronomist overrides the prediction |
| corrected_soil_class | text | | Null unless manually_corrected = true |
| created_at | timestamptz | DEFAULT now() | |

**Table: `pest_scans`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| crop_record_id | uuid | FK → crop_records.id, NOT NULL | |
| advisory_message_id | uuid | FK → advisory_messages.id | |
| storage_path | text | NOT NULL | Path in Supabase S3 pest-images bucket |
| predicted_pest_or_disease | text | NOT NULL | |
| confidence_score | numeric | NOT NULL | |
| growth_stage_at_scan | text | | Copied from crop_records.growth_stage at scan time — snapshotted deliberately |
| created_at | timestamptz | DEFAULT now() | |

**Table: `crop_recommendation_requests`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| farm_id | uuid | FK → farms.id, NOT NULL | |
| advisory_message_id | uuid | FK → advisory_messages.id | |
| input_nitrogen | numeric | | |
| input_phosphorus | numeric | | |
| input_potassium | numeric | | |
| input_ph | numeric | | |
| input_temperature | numeric | | |
| input_humidity | numeric | | |
| input_rainfall | numeric | | |
| top_recommendation | text | | Highest-ranked crop name |
| recommendation_scores | jsonb | | Full ranked list: [{crop, score}, ...] |
| created_at | timestamptz | DEFAULT now() | |

**Table: `price_forecast_requests`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| farmer_id | uuid | FK → farmers.id, NOT NULL | |
| advisory_message_id | uuid | FK → advisory_messages.id | |
| crop_name | text | NOT NULL | |
| district | text | NOT NULL | District used for mandi price lookup |
| forecast_horizon_days | integer | | 7 or 14 |
| directional_signal | text | NOT NULL | 'UP', 'DOWN', 'STABLE' |
| forecast_mape | numeric | | Model MAPE at time of generation |
| generated_at | timestamptz | DEFAULT now() | |

---

### 5.7 Reference / Lookup Domain

**Table: `ref_crops`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| crop_name_en | text | NOT NULL, UNIQUE | Canonical English name |
| crop_name_ta | text | | Tamil name |
| crop_name_te | text | | Telugu name |
| crop_type | text | | 'cereal', 'pulse', 'oilseed', 'vegetable', 'fruit' |
| typical_seasons | text[] | | e.g. ['kharif', 'rabi'] |

**Table: `ref_locations`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| state | text | NOT NULL | |
| district | text | NOT NULL | |
| block | text | | |
| village | text | | |

**Table: `ref_knowledge_documents`**
| Column | Type | Constraints | Notes |
|---|---|---|---|
| id | uuid | PK | |
| document_name | text | NOT NULL | |
| topic_category | text | | 'pest', 'irrigation', 'soil', 'market', 'crop_planning' |
| region_tag | text | | Used as Dify metadata filter |
| crop_tag | text | | Used as Dify metadata filter |
| season_tag | text | | Used as Dify metadata filter |
| ingested_at | timestamptz | | When document was loaded into Dify |
| chunk_count | integer | | Number of 300–500 token chunks created |

---

## 6. Supabase Storage (S3 Buckets)

There are exactly two storage buckets. Do not create additional buckets without updating this document.

### Bucket: `soil-images`
- **Access:** Private. RLS policy: authenticated farmer can only read/write objects where path begins with their own `farmer_id`
- **Path convention:** `{farmer_id}/{farm_id}/{timestamp}.jpg`
- **Retention:** Permanent. Never auto-delete. These are real-world training samples for YOLOv8n retraining
- **Referenced by:** `soil_scans.storage_path`

### Bucket: `pest-images`
- **Access:** Private. Same RLS scoping as soil-images
- **Path convention:** `{farmer_id}/{crop_record_id}/{timestamp}.jpg`
- **Retention:** Permanent. Retained for future regional pest outbreak detection capability
- **Referenced by:** `pest_scans.storage_path`

### What is NOT stored in S3
- Voice note audio files — processed by Whisper in memory, immediately discarded
- Expense log entries — structured data, database only
- Farm records and crop records — structured data, database only
- Advisory messages — structured data, database only
- Any intermediate ML processing files — never persisted

---

## 7. External APIs and Services

### Open-Meteo
- **Purpose:** Live weather data for farmer's district
- **Called by:** FastAPI context assembly step, once per advisory request
- **Data used in context:** temperature, humidity, rainfall forecast, wind
- **Cost:** Free, no API key required
- **Docs:** https://open-meteo.com/en/docs

### data.gov.in
- **Purpose:** Historical district-level mandi (agricultural market) commodity price data
- **Called by:** Price Forecasting microservice
- **Used to train:** Prophet forecasting model
- **Cost:** Free, open government data
- **Docs:** https://data.gov.in/

---

## 8. Technology Stack Reference

Agents must adhere to this architectural vision. Cloud API LLMs are preferred for speed/quality, while local models act as a critical fallback mechanism to ensure constant availability.

| Component | Technology | Version / Notes |
|---|---|---|
| PWA Frontend | React + Vite | |
| Voice capture | Browser MediaRecorder API | Native, no library |
| Backend API | FastAPI | Python |
| Auth | Supabase Auth | Phone/OTP |
| Database | Supabase PostgreSQL | Self-hosted |
| Object storage | Supabase Storage (S3) | Self-hosted |
| RAG agent | Dify Community Edition | Self-hosted via Docker |
| Vector search | FAISS | Within Dify |
| Embeddings | nomic-embed-text | Via Ollama |
| LLM | Cloud APIs & Llama 3.1 8B | Cloud API primary, Ollama local fallback |
| Voice transcription | Whisper base (74M params) | Local, no cloud |
| Soil classification | YOLOv8n | Ultralytics, classification mode |
| Crop recommendation | Random Forest | scikit-learn |
| Price forecasting | Prophet | Meta/Facebook |
| Containerisation | Docker Compose | All services |
| Cloud cost | Variable | Free tiers or funded API keys for LLMs |

---

## 9. Row Level Security Rules

Every agent writing database migrations or policies must implement these. These are not optional.

- A farmer can only SELECT, INSERT, UPDATE their own rows — enforced by `auth.uid() = farmer_id`
- A farmer can never DELETE advisory_messages, soil_scans, or pest_scans — these are audit and training records
- Reference tables (ref_crops, ref_locations, ref_knowledge_documents) are read-only for all farmers, writable only by service role
- Storage buckets enforce path-prefix RLS — a farmer's objects must begin with their own farmer_id

---

## 10. Safety and Advisory Guardrails

These constraints are implemented in the Dify agent prompt. Any agent modifying the advisory pipeline must preserve all of them.

- The system will **never** provide specific pesticide dosages or chemical formulations
- The system will **never** make financial predictions or guaranteed market price forecasts
- The system will **never** provide medical advice, even for farm animals, beyond basic symptom description
- For any query outside these boundaries, the system defers to Krishi Vigyan Kendra (KVK) — the nearest government agricultural extension centre
- All deferral events are logged in `advisory_messages.was_deferred_to_kvk = true`
- The system should acknowledge when retrieved context is insufficient rather than hallucinate an answer

---

## 11. Evaluation Metrics (for context)

These are the validated results from the research paper. Agents building new features should not degrade these benchmarks.

| Module | Metric | Value |
|---|---|---|
| Soil Classification | F1 | 91.69% |
| Crop Recommendation | F1 | 89.94% |
| Season Detection | F1 | 87.37% |
| Price Forecasting | MAPE | 9.68% |
| Price Forecasting | Directional Accuracy ±5% | 76.78% |
| RAG Faithfulness (Ragas) | vs Non-RAG baseline | 94.5% (baseline: 6.9%) |
| RAG Answer Relevancy | | 89.3% |
| RAG Context Recall | | 65.0% |
| RAG Context Precision | | 61.2% |
| Advisory latency P50 | | 2.0 seconds |
| Pipeline success rate | | 100% (96/96 traces) |

---

## 12. Known Limitations and Planned Future Work

Agents should be aware of these gaps and not build features that assume they are resolved.

- **No multilingual UI yet** — Tamil and Telugu are planned; the schema supports it via `ref_crops` name columns and `farmers.preferred_language`
- **Context Recall is 65%** — known gap; improvement path is semantic chunking (move from character-based to semantic splits) and Top-K calibration in Dify
- **No field trial data** — the system has been evaluated in a lab/prototype context only; no real farmer cohort data exists yet
- **No user study** — usability with actual farmers has not been formally measured
- **Latency P99 is 560 seconds under batch load** — this is a Ragas evaluation artifact from high-concurrency LLM judge calls; single-query interactive latency is unaffected
- **Soil image dataset is small** — YOLOv8n trained on limited field captures; production accuracy will improve as farmer uploads accumulate
- **Price forecasting MAPE of 9.68%** — adequate for directional signals but not precise enough for exact price prediction; communicate to farmers as trend guidance only, never as a guarantee

---

## 13. Agent Behavioural Rules

These rules apply to any AI agent or automated system processing this document.

1. **Cloud LLMs are primary, local LLMs are fallbacks.** Always use a cloud LLM API (Groq, OpenAI, Anthropic, Gemini) as the primary inference engine in the advisory pipeline for speed and intelligence. The local self-hosted Llama 3.1 8B is kept strictly as a fallback in case of API outages or quota limits.

2. **Never store farmer voice audio** anywhere — not temporarily in a database column, not as a named file in S3, not in logs. Audio is memory-only, transcribe-and-discard.

3. **Never bypass RLS** using the service role key in application code. The service role is for migrations and admin tooling only.

4. **Always preserve the full audit trail** — advisory_messages.context_block_sent and retrieved_chunk_ids must be populated on every advisory turn without exception.

5. **Treat farmer_id as sacred** — it appears as a foreign key in nearly every table. Always validate it against auth.uid() before any write operation.

6. **Do not modify ref_ tables** through the application layer. These are seeded reference data, modified only through controlled migrations.

7. **The Dify knowledge base and the PostgreSQL database are separate stores** — do not attempt to sync them automatically. Knowledge base updates are manual, migration-controlled operations.

8. **When in doubt about a safety guardrail**, err on the side of deferring to KVK and logging the deferral. A false deferral is safer than a harmful recommendation.

9. **All new tables must include** `farmer_id uuid FK → farmers.id` and RLS policies before being used in production.

10. **Context assembly (Section 4, Step 2) must remain a single-pass read** — no recursive queries, no paginated fetches, no waiting for ML results that should have already been computed upstream.

---

## 14. File and Directory Conventions

```
/
├── frontend/              # React + Vite PWA
│   ├── src/
│   │   ├── screens/       # Onboarding, AskSakhi, FarmRecords, ExpenseLog
│   │   ├── components/    # Shared UI components
│   │   └── hooks/         # Supabase client, auth, voice recorder
│   └── public/            # PWA manifest, service worker
│
├── backend/               # FastAPI application
│   ├── routers/           # advisory, farms, crops, expenses, auth
│   ├── services/          # context_assembler, ml_dispatcher, weather
│   └── models/            # Pydantic schemas matching DB tables
│
├── ml/                    # ML microservices (each independently deployable)
│   ├── soil_classifier/   # YOLOv8n FastAPI service
│   ├── crop_recommender/  # Random Forest FastAPI service
│   ├── price_forecaster/  # Prophet FastAPI service
│   └── transcriber/       # Whisper FastAPI service
│
├── dify/                  # Dify config, chatflow exports, knowledge base ingestion scripts
├── supabase/
│   ├── migrations/        # All schema migrations in order
│   └── seed/              # ref_crops, ref_locations seed data
│
└── docker-compose.yml     # Brings up all services together
```

---

*Last updated: based on research paper submission draft and schema design session. Update this document before making any architectural changes.*
