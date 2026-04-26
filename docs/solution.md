# Krishi Sakhi — Solution Reference Document

> Authoritative context document for AI agents, developers, and automated systems. Covers architecture, data flows, schema relationships, ML modules, RLS, and operational constraints. Read fully before writing code, migrations, or queries.

---

## 1. Project Identity

| Property | Value |
|---|---|
| Name | Krishi Sakhi ("Farmer's Friend") |
| Type | Agricultural Decision Support Platform |
| Target Users | Smallholder farmers — Tamil Nadu & Andhra Pradesh |
| Interface | Progressive Web App (PWA), mobile-first, Android-installable |
| Deployment | Hybrid (Supabase Cloud + Self-hosted Dify/ML) |
| Cloud Cost | Managed via Free Tiers (Supabase, Groq/OpenRouter) |
| Stage | Research prototype — not yet in field trial |

**Problem:** India's extension worker-to-farmer ratio has fallen below 1:5,000. Krishi Sakhi replaces fragmented, inaccessible advisory with a single grounded AI-assisted interface operable on low-end smartphones under intermittent connectivity.

---

## 2. System Architecture

```mermaid
graph TB
    subgraph CLIENT["Layer 1 — Client (PWA)"]
        PWA["React + Vite PWA\nAndroid-installable"]
        INPUT["Input Modalities\nText / Voice / Image"]
        SW["Service Worker\nOffline + Deferred Sync"]
    end

    subgraph ORCH["Layer 2 — Advisory (Dify)"]
        DIFY["Dify Community Edition\nRAG Agent Chatbot"]
        QDRANT["Qdrant Cloud\nVector Store (Dify native)"]
        LLM["Cloud LLM\nGroq Llama-3.1-8b-instant / OpenRouter Gemini"]
        KB["Knowledge Base\n6 KB markdown files\ningested via Dify Dataset UI"]
    end

    subgraph BACKEND["Layer 3 — Backend & Data (FastAPI + Supabase Cloud)"]
        API["FastAPI Backend\nAuth / Routing / Context Assembly"]
        SUPA_DB["Supabase PostgreSQL (Cloud)\nAll structured data + RLS"]
        SUPA_S3["Supabase Storage S3 (Cloud)\nsoil-images / pest-images"]
        SUPA_AUTH["Supabase Auth (Cloud)\nPhone OTP / JWT"]
    end

    subgraph ML["ML Microservices (independent FastAPI services)"]
        SOIL["Soil Classifier\nYOLOv8n — F1: 91.69%"]
        CROP["Crop Recommender\nRandom Forest — F1: 89.94%"]
        PRICE["Price Forecaster\nProphet — MAPE: 9.68%"]
        WHISPER["Voice Transcriber\nWhisper base 74M"]
        SEASON["Season Detector\nRule-based — F1: 87.37%"]
    end

    subgraph EXT["External APIs"]
        WEATHER["Open-Meteo\nLive weather (free, no key)"]
        MANDI["data.gov.in\nMandi price data (free)"]
    end

    PWA --> INPUT
    INPUT --> API
    SW -.->|offline cache| PWA
    API --> SUPA_AUTH
    API --> DIFY
    API --> ML
    API --> SUPA_DB
    API --> WEATHER
    DIFY --> QDRANT
    QDRANT --> KB
    DIFY --> LLM
    PRICE --> MANDI
    SOIL --> SUPA_S3
```

---

## 3. Request Data Flow

```mermaid
sequenceDiagram
    actor Farmer
    participant PWA
    participant FastAPI
    participant Whisper
    participant MLService as ML Microservice
    participant SupaDB as Supabase DB
    participant OpenMeteo
    participant Dify
    participant LLM as Cloud LLM (with Local Fallback)

    Farmer->>PWA: Submit input (text / voice / image)

    alt Voice input
        PWA->>Whisper: Audio blob
        Whisper-->>FastAPI: Transcribed text (audio discarded immediately)
    else Image input
        PWA->>MLService: Image (soil or pest)
        MLService-->>FastAPI: ML result (class + confidence)
        MLService->>SupaDB: Write soil_scans / pest_scans
    else Text input
        PWA->>FastAPI: Text directly
    end

    FastAPI->>SupaDB: Query farmers (name, district, language)
    FastAPI->>SupaDB: Query farms (area, soil_type, irrigation_type)
    FastAPI->>SupaDB: Query crop_records WHERE status='active'
    FastAPI->>SupaDB: Query expense_logs (last 30 days, grouped by category)
    FastAPI->>OpenMeteo: Live weather for farmer's district

    FastAPI->>FastAPI: Assemble context_block_sent (JSON)

    FastAPI->>Dify: POST Chat API (farmer_input_text + context_block + ml_outputs)
    Dify->>Dify: Qdrant vector search via Knowledge Retrieval node (Dify native)
    Dify->>LLM: Generate response with retrieved chunks
    LLM-->>Dify: Response text
    Dify->>Dify: Evaluate safety guardrails
    Dify-->>FastAPI: Formatted response

    FastAPI->>SupaDB: INSERT advisory_messages (full audit record)
    FastAPI->>SupaDB: INCREMENT advisory_sessions.total_turns (trigger)
    FastAPI-->>PWA: Advisory response

    PWA-->>Farmer: Display response
```

---

## 4. Database Schema

### 4.1 Entity Relationship Diagram

```mermaid
erDiagram
    auth_users {
        uuid id PK
        text phone
        timestamptz created_at
    }

    farmers {
        uuid id PK, FK
        text full_name
        text preferred_language
        text state
        text district
        text block
        text village
        boolean onboarding_complete
        timestamptz created_at
        timestamptz updated_at
    }

    farms {
        uuid id PK
        uuid farmer_id FK
        text farm_name
        numeric area_acres
        text soil_type
        text irrigation_type
        numeric latitude
        numeric longitude
        timestamptz created_at
    }

    crop_records {
        uuid id PK
        uuid farm_id FK
        uuid farmer_id FK
        text crop_name
        text season
        date sowing_date
        date expected_harvest_date
        date actual_harvest_date
        text growth_stage
        text status
        timestamptz created_at
        timestamptz updated_at
    }

    yield_records {
        uuid id PK
        uuid crop_record_id FK, UK
        uuid farmer_id FK
        numeric yield_kg
        numeric sale_price_per_kg
        date sale_date
        text buyer_type
        text notes
        timestamptz created_at
    }

    expense_logs {
        uuid id PK
        uuid crop_record_id FK
        uuid farmer_id FK
        text category
        numeric amount_inr
        date expense_date
        text notes
        timestamptz created_at
    }

    advisory_sessions {
        uuid id PK
        uuid farmer_id FK
        uuid crop_record_id FK
        timestamptz started_at
        timestamptz ended_at
        integer total_turns
    }

    advisory_messages {
        uuid id PK
        uuid session_id FK
        uuid farmer_id FK
        text input_channel
        text farmer_input_text
        numeric whisper_confidence
        jsonb context_block_sent
        text_array retrieved_chunk_ids
        text response_text
        boolean was_deferred_to_kvk
        integer response_latency_ms
        timestamptz created_at
    }

    soil_scans {
        uuid id PK
        uuid farmer_id FK
        uuid farm_id FK
        uuid advisory_message_id FK
        text storage_path
        text predicted_soil_class
        numeric confidence_score
        boolean manually_corrected
        text corrected_soil_class
        timestamptz created_at
    }

    pest_scans {
        uuid id PK
        uuid farmer_id FK
        uuid crop_record_id FK
        uuid advisory_message_id FK
        text storage_path
        text predicted_pest_or_disease
        numeric confidence_score
        text growth_stage_at_scan
        timestamptz created_at
    }

    crop_recommendation_requests {
        uuid id PK
        uuid farmer_id FK
        uuid farm_id FK
        uuid advisory_message_id FK
        numeric input_nitrogen
        numeric input_phosphorus
        numeric input_potassium
        numeric input_ph
        numeric input_temperature
        numeric input_humidity
        numeric input_rainfall
        text top_recommendation
        jsonb recommendation_scores
        timestamptz created_at
    }

    price_forecast_requests {
        uuid id PK
        uuid farmer_id FK
        uuid advisory_message_id FK
        text crop_name
        text district
        integer forecast_horizon_days
        text directional_signal
        numeric forecast_mape
        timestamptz generated_at
    }

    ref_crops {
        uuid id PK
        text crop_name_en
        text crop_name_ta
        text crop_name_te
        text crop_type
        text_array typical_seasons
    }

    ref_locations {
        uuid id PK
        text state
        text district
        text block
        text village
    }

    ref_knowledge_documents {
        uuid id PK
        text document_name
        text topic_category
        text region_tag
        text crop_tag
        text season_tag
        timestamptz ingested_at
        integer chunk_count
    }

    auth_users ||--|| farmers : "id = auth UID"
    farmers ||--o{ farms : "farmer_id"
    farms ||--o{ crop_records : "farm_id"
    farmers ||--o{ crop_records : "farmer_id (denorm)"
    crop_records ||--o| yield_records : "crop_record_id"
    crop_records ||--o{ expense_logs : "crop_record_id"
    crop_records ||--o{ pest_scans : "crop_record_id"
    crop_records ||--o{ crop_recommendation_requests : "crop_record_id (via advisory_message)"
    farmers ||--o{ advisory_sessions : "farmer_id"
    advisory_sessions ||--o{ advisory_messages : "session_id"
    advisory_messages ||--o| soil_scans : "advisory_message_id"
    advisory_messages ||--o| pest_scans : "advisory_message_id"
    advisory_messages ||--o| crop_recommendation_requests : "advisory_message_id"
    advisory_messages ||--o| price_forecast_requests : "advisory_message_id"
    farms ||--o{ soil_scans : "farm_id"
    farmers ||--o{ soil_scans : "farmer_id"
    farmers ||--o{ pest_scans : "farmer_id"
    farmers ||--o{ price_forecast_requests : "farmer_id"
```

### 4.2 Table Domain Summary

| Table | Domain | RLS INSERT | RLS DELETE | Notes |
|---|---|---|---|---|
| `farmers` | Profile | Own row | ❌ | id = auth.uid() |
| `farms` | Profile | Own row | Own row | Blocked if active crop_records exist |
| `crop_records` | Crop | Own row | ❌ | Partial unique index on (farm_id) WHERE status='active' |
| `yield_records` | Crop | Own row | ❌ | UNIQUE on crop_record_id |
| `expense_logs` | Expense | Own row | Own row | Correctable entries |
| `advisory_sessions` | Advisory | Own row | ❌ | |
| `advisory_messages` | Advisory | **Service role only** | ❌ | Immutable audit record |
| `soil_scans` | ML Output | **Service role only** | ❌ | Training data permanent |
| `pest_scans` | ML Output | **Service role only** | ❌ | |
| `crop_recommendation_requests` | ML Output | **Service role only** | ❌ | |
| `price_forecast_requests` | ML Output | **Service role only** | ❌ | |
| `ref_crops` | Reference | Service role only | Service role only | Static seed data |
| `ref_locations` | Reference | Service role only | Service role only | Static seed data |
| `ref_knowledge_documents` | Reference | Service role only | Service role only | Dify knowledge registry |

---

## 5. Migration Order

```mermaid
graph LR
    E001[001_enable_extensions] --> E002
    E002[002_ref_locations] --> E003
    E003[003_ref_crops] --> E004
    E004[004_farmers] --> E005
    E005[005_farms] --> E006
    E006[006_crop_records] --> E007
    E007[007_yield_records] --> E008
    E008[008_expense_logs] --> E009
    E009[009_advisory_sessions] --> E010
    E010[010_advisory_messages] --> E011
    E011[011_soil_scans] --> E012
    E012[012_pest_scans] --> E013
    E013[013_crop_recommendation_requests] --> E014
    E014[014_price_forecast_requests] --> E015
    E015[015_ref_knowledge_documents] --> E016
    E016[016_triggers] --> E017
    E017[017_rls_policies] --> E018
    E018[018_storage_buckets] --> E019
    E019[019_seed_ref_data]
```

---

## 6. Context Assembly Query (Hot Path)

This runs on **every advisory request**. Must complete in a single pass. No recursive queries. No pagination. Target: P50 ≤ 2 seconds end-to-end.

```mermaid
flowchart TD
    A[JWT — farmer_id] --> B[SELECT farmers\nname, district, language]
    A --> C[SELECT farms\nmost recently updated\narea, soil_type, irrigation_type]
    A --> D[SELECT crop_records\nWHERE status='active'\ncrop, season, growth_stage, dates]
    D --> E[SELECT expense_logs\nLast 30 days, active crop\nGROUP BY category → SUM amount_inr]
    A --> F[Open-Meteo API\ntemp, humidity, rainfall, forecast]
    B & C & D & E & F --> G[Assemble context_block_sent JSONB]
    G --> H[POST to Dify Chat API]
```

**context_block_sent structure:**
```json
{
  "farmer": { "name": "", "district": "", "language": "" },
  "farm": { "name": "", "area_acres": 0, "soil_type": "", "irrigation_type": "" },
  "active_crop": { "name": "", "season": "", "growth_stage": "", "sowing_date": "" },
  "recent_expenses": { "seeds": 0, "fertilizer": 0, "pesticide": 0 },
  "weather": { "temp": 0, "humidity": 0, "rainfall": 0, "forecast": "" },
  "ml_outputs": {}
}
```

---

## 7. ML Microservices

```mermaid
graph TD
    subgraph SOIL_SVC["Soil Classifier"]
        S_IN["Input: soil surface image"]
        S_MODEL["YOLOv8n classification mode"]
        S_OUT["Output: class + confidence\nclay/loam/sandy/red/black/alluvial"]
        S_STORE["Store: soil-images S3 bucket\nWrite: soil_scans table\nUpdate: farms.soil_type via trigger"]
        S_IN --> S_MODEL --> S_OUT --> S_STORE
    end

    subgraph CROP_SVC["Crop Recommender"]
        C_IN["Input: N, P, K, pH, temp,\nhumidity, rainfall (7 features)"]
        C_MODEL["Random Forest — 22 crop classes"]
        C_OUT["Output: ranked crop list + confidence scores"]
        C_STORE["Write: crop_recommendation_requests"]
        C_IN --> C_MODEL --> C_OUT --> C_STORE
    end

    subgraph PRICE_SVC["Price Forecaster"]
        P_IN["Input: crop name + district\n+ historical mandi data"]
        P_MODEL["Prophet time-series model"]
        P_OUT["Output: UP/DOWN/STABLE\n+ MAPE (7 or 14 day horizon)"]
        P_STORE["Write: price_forecast_requests"]
        P_IN --> P_MODEL --> P_OUT --> P_STORE
    end

    subgraph VOICE_SVC["Voice Transcriber & Synthesizer"]
        V_IN["Input: audio blob (MediaRecorder)"]
        V_STT["Groq whisper-large-v3-turbo (Cloud STT)"]
        V_TTS["Google gTTS — Indian English (tld=co.in)"]
        V_OUT["Output: transcribed text & Base64 audio"]
        V_DISCARD["Audio NEVER stored — discarded in memory"]
        V_IN --> V_STT --> V_OUT
        V_TTS --> V_OUT
        V_STT --> V_DISCARD
    end

    subgraph SEASON_SVC["Season Detector"]
        SE_IN["Input: current date + district"]
        SE_MODEL["Rule-based + lightweight classifier"]
        SE_OUT["Output: Kharif/Rabi/Zaid + confidence"]
        SE_IN --> SE_MODEL --> SE_OUT
    end
```

### ML Module Performance

| Module | Metric | Value |
|---|---|---|
| Soil Classification | F1 | 91.69% |
| Crop Recommendation | F1 | 89.94% |
| Season Detection | F1 | 87.37% |
| Price Forecasting | MAPE | 9.68% |
| Price Forecasting | Directional Accuracy ±5% | 76.78% |
| RAG Faithfulness (Ragas) | vs Non-RAG (6.9%) | 94.5% |
| RAG Answer Relevancy | | 89.3% |
| RAG Context Recall | | 65.0% |
| RAG Context Precision | | 61.2% |
| Advisory latency | P50 | 2.0 seconds |
| Pipeline success rate | | 100% (96/96 traces) |

---

## 8. RAG Advisory Pipeline

```mermaid
flowchart LR
    QUERY["Farmer Query\n+ context_block"] --> DIFY["Dify RAG Agent\nChat API"]
    DIFY --> KB_NODE["Knowledge Retrieval Node\n(Dify native — queries Qdrant)"]
    KB_NODE --> CHUNKS["Retrieved chunks from Qdrant"]
    CHUNKS --> PROMPT["Data-augmented prompt"]
    PROMPT --> LLM["Groq Llama-3.1-8b-instant (text)\nOpenRouter Gemini 2.5 Flash (vision)"]
    LLM --> SAFETY{"Safety guardrail\nevaluation"}
    SAFETY -->|Safe| RESPONSE["Return response"]
    SAFETY -->|Unsafe| KVK["Defer to KVK\nwas_deferred_to_kvk = true"]
    RESPONSE --> LOG["Log: advisory_messages\ncontext_block_sent + retrieved_chunk_ids"]
    KVK --> LOG
```

**Safety guardrails — never permit:**
- Specific pesticide dosages or chemical formulations
- Financial predictions or guaranteed market price forecasts
- Medical advice (farm animals or humans)
- Any query outside agricultural scope

All deferral events logged: `advisory_messages.was_deferred_to_kvk = true`

---

## 9. Storage Buckets

| Bucket | Path Convention | Retention | RLS |
|---|---|---|---|
| `soil-images` | `{farmer_id}/{farm_id}/{unix_ts}.jpg` | Permanent (training data) | Path must start with `auth.uid()` |
| `pest-images` | `{farmer_id}/{crop_record_id}/{unix_ts}.jpg` | Permanent | Path must start with `auth.uid()` |

**Voice audio is NEVER stored.** Whisper processes in memory and discards immediately.

---

## 10. Database Triggers

```mermaid
flowchart TD
    T1["BEFORE UPDATE on farmers\n→ fn_set_updated_at()\nSets updated_at = now()"]
    T2["BEFORE UPDATE on crop_records\n→ fn_set_updated_at()\nSets updated_at = now()"]
    T3["AFTER INSERT on advisory_messages\n→ fn_increment_session_total_turns()\nIncrements advisory_sessions.total_turns"]
    T4["AFTER INSERT on soil_scans\n→ fn_soil_scan_update_farm()\nIF manually_corrected=false:\n  farms.soil_type = predicted_soil_class\nELSE:\n  farms.soil_type = corrected_soil_class"]
    T5["AFTER UPDATE OF manually_corrected, corrected_soil_class ON soil_scans\n→ fn_soil_scan_update_farm()\nOnly fires when manually_corrected=true AND corrected_soil_class IS NOT NULL"]
```

---

## 11. Auth & RLS Architecture

```mermaid
flowchart TD
    PHONE["Farmer Phone Number"] --> OTP["Supabase Phone OTP"]
    OTP --> JWT["JWT Token issued\nauth.uid() = farmer UUID"]
    JWT --> RLS["Row Level Security\nAll tables: auth.uid() = farmer_id"]
    JWT --> STORAGE_RLS["Storage RLS\nPath prefix = auth.uid()"]
    
    SVC_ROLE["Service Role Key\n(backend only)"] --> ML_TABLES["ML output tables INSERT/UPDATE\nadvisory_messages INSERT\nsoil_scans UPDATE (correction)"]
    
    RLS --> FARMER_DATA["Farmer sees only\nown rows across all tables"]
    STORAGE_RLS --> FARMER_FILES["Farmer sees only\nown files in S3"]
```

**RLS rules summary:**
- `auth.uid() = farmer_id` on all application tables
- `auth.uid() = id` on `farmers` table (PK = auth UID)
- Service role required for: advisory_messages INSERT, all ML output table INSERT/UPDATE
- DELETE disabled on: farmers, crop_records, yield_records, advisory_sessions, advisory_messages, soil_scans, pest_scans, crop_recommendation_requests, price_forecast_requests

---

## 12. Technology Stack

| Layer | Component | Technology |
|---|---|---|
| Frontend | PWA | React + Vite |
| Frontend | Voice capture | Browser MediaRecorder API (native) |
| Frontend | Offline | Service Worker |
| Backend | API | FastAPI (Python) |
| Backend | Auth | Supabase Auth (Cloud) — Phone OTP |
| Backend | Database | Supabase PostgreSQL (Cloud) |
| Backend | Storage | Supabase Storage / S3 (Cloud) |
| RAG | Agent | Dify Community Edition (self-hosted Chat API) |
| RAG | Vector search | Qdrant Cloud (Dify native VECTOR_STORE) |
| RAG | Embeddings | Dify-managed embedding provider |
| RAG | LLM (text) | Groq `Llama-3.1-8b-instant` |
| RAG | LLM (vision) | OpenRouter `google/gemini-2.5-flash-image-preview:free` |
| RAG | LLM (fallback) | Groq direct API call (if Dify fails) |
| ML | Voice STT | Groq `whisper-large-v3-turbo` (Cloud, English) |
| ML | Voice TTS | Google gTTS — Indian English (`tld=co.in`) |
| ML | Soil | YOLOv8n (Ultralytics, classification mode) |
| ML | Crops | Random Forest (scikit-learn) |
| ML | Prices | Prophet (Meta/Facebook) / rule-based directional |
| Infra | Containers | Docker Compose |
| External | Weather | Open-Meteo (free, no key) |
| External | Mandi prices | data.gov.in (free, open government) |

**Constraints & Strategy:**
- Utilize free tiers (Supabase Cloud, Groq, OpenRouter) — no local GPU or Ollama required.
- FAISS, Ollama, n8n, and nomic-embed-text are NOT in this stack — replaced by Qdrant + Groq + Dify native retrieval.

---

## 13. Key Indexes

| Table | Index | Purpose |
|---|---|---|
| `farmers` | `(district)` | Price forecast joins, RAG context |
| `farms` | `(farmer_id)` | Context assembly |
| `crop_records` | `(farmer_id)`, `(farm_id)`, `(status)` | Context assembly hot path |
| `crop_records` | `UNIQUE (farm_id) WHERE status='active'` | One active crop per farm |
| `expense_logs` | `(farmer_id)`, `(crop_record_id)`, `(expense_date)` | 30-day summary query |
| `advisory_messages` | `(farmer_id)`, `(session_id)`, `(created_at)` | History queries |
| `advisory_messages` | `(was_deferred_to_kvk) WHERE true` | Safety compliance reports |
| `soil_scans` | `(manually_corrected) WHERE true` | Retraining dataset extraction |
| `pest_scans` | `(predicted_pest_or_disease)` | Future outbreak detection |
| `price_forecast_requests` | `(crop_name, district)` | Model performance aggregation |
| `ref_locations` | `(state, district)`, `(district)` | Onboarding dropdowns |

---

## 14. Constraints Reference

### CHECK Constraints (Critical)

| Table.Column | Allowed Values |
|---|---|
| `farmers.preferred_language` | `english`, `tamil`, `telugu` |
| `farms.soil_type` | `clay`, `loam`, `sandy`, `red`, `black`, `alluvial` |
| `farms.irrigation_type` | `rainfed`, `canal`, `borewell`, `drip`, `other` |
| `crop_records.season` | `kharif`, `rabi`, `zaid` |
| `crop_records.growth_stage` | `germination`, `vegetative`, `flowering`, `maturity`, `post-harvest` |
| `crop_records.status` | `active`, `harvested`, `abandoned` |
| `expense_logs.category` | `seeds`, `fertilizer`, `pesticide`, `labour`, `irrigation`, `equipment`, `other` |
| `advisory_messages.input_channel` | `text`, `voice`, `image` |
| `advisory_messages.whisper_confidence` | `NULL` when `input_channel != 'voice'` |
| `soil_scans.predicted_soil_class` | `clay`, `loam`, `sandy`, `red`, `black`, `alluvial` |
| `soil_scans.corrected_soil_class` | Same as above; NOT NULL when `manually_corrected = true` |
| `pest_scans.growth_stage_at_scan` | `germination`, `vegetative`, `flowering`, `maturity` |
| `price_forecast_requests.directional_signal` | `UP`, `DOWN`, `STABLE` |
| `price_forecast_requests.forecast_horizon_days` | `7`, `14` |
| `advisory_sessions.ended_at` | `NULL OR >= started_at` |

---

## 15. Known Limitations

| Gap | Status | Improvement Path |
|---|---|---|
| Multilingual UI (Tamil/Telugu) | Planned | Schema supports it via `ref_crops` name columns + `farmers.preferred_language` |
| Context Recall 65% | Known | Semantic chunking (character → semantic splits); Top-K calibration |
| No field trial data | Planned | No real farmer cohort yet |
| Latency P99 = 560s | Evaluation artifact only | Ragas batch LLM judge calls; interactive latency unaffected |
| Soil dataset small | Active | Each farmer upload is a training sample; improves with adoption |
| Price MAPE 9.68% | Acceptable for directional | Never surface as exact price; directional signal only |

---

## 16. Agent Behavioural Rules

1. Utilize Cloud LLM APIs (e.g., Groq, OpenAI, Anthropic) as the primary intelligence engine, maintaining local self-hosted LLMs strictly as a highly-available fallback mechanism.
2. Never store voice audio anywhere — memory-only, transcribe-and-discard.
3. Never bypass RLS with service role key in application code — service role for migrations/admin only.
4. Always populate `advisory_messages.context_block_sent` and `retrieved_chunk_ids` on every turn.
5. Validate `farmer_id` against `auth.uid()` before any write operation.
6. Do not modify `ref_*` tables through application layer — migration-controlled only.
7. Knowledge base ingestion is done via the Dify Dataset UI — do NOT use n8n or custom Python ingestion scripts.
8. When safety guardrail is ambiguous — defer to KVK and log.
9. All new tables must include `farmer_id uuid FK → farmers.id` + RLS before production use.
10. Supabase Cloud is the source of truth for DB and Storage; context assembly still requires single-pass reads.

---

## 17. Directory Structure

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
├── ml/
│   ├── soil_classifier/   # YOLOv8n FastAPI service
│   ├── crop_recommender/  # Random Forest FastAPI service
│   ├── price_forecaster/  # Prophet FastAPI service
│   └── transcriber/       # Whisper FastAPI service
│
├── dify/                  # Dify config, chatflow exports, knowledge base ingestion scripts
├── supabase/
│   ├── migrations/        # 001–019 ordered SQL migrations
│   └── seed/              # ref_crops, ref_locations data
│
└── docker-compose.yml     # All services
```

---

*solution.md v1.0 — derived from context.md, schema.md, migration files, and research paper. Update before architectural changes.*