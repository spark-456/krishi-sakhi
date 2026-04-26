# Krishi Sakhi — Solution Reference Document

> Authoritative technical reference for the Krishi Sakhi platform. Covers architecture, data flows, schema relationships, ML modules, RLS, and operational constraints.
> Last updated: 2026-04-26

---

## 1. Project Identity

| Property | Value |
|---|---|
| Name | Krishi Sakhi ("Farmer's Friend") |
| Type | Agricultural Decision Support Platform |
| Target Users | Smallholder farmers — Tamil Nadu & Andhra Pradesh |
| Interface | Progressive Web App (PWA), mobile-first, Android-installable |
| Deployment | Hybrid (Supabase Cloud + Self-hosted Dify/ML) |
| Cloud Cost | Managed via Free Tiers (Supabase, Groq, OpenRouter, Qdrant) |
| Stage | Research prototype — not yet in field trial |

**Problem:** India's extension worker-to-farmer ratio has fallen below 1:5,000. Krishi Sakhi replaces fragmented, inaccessible advisory with a single grounded AI-assisted interface operable on low-end smartphones under intermittent connectivity.

---

## 2. System Architecture

### 2.1 Layer 1 — Client (PWA)
- **Framework:** React + Vite + TailwindCSS
- **Installable on Android** without Play Store dependency
- **Input modalities:** Text chat, voice note (browser MediaRecorder API), image upload (camera or gallery)
- **Offline support:** Service worker caches the application shell; deferred sync when connectivity restores
- **Screens:** Welcome, Phone Login, Registration, Dashboard, Ask Sakhi (chat), Farm Records, Add Farm, Activity Logs, Finance Tracker, Camera (soil/pest), Profile
- **Community (SakhiNet):** Cooperative group creation, shared resources, help requests, and group messaging.
- **Admin Portal:** D3.js Network Graph, farmer directory, ticket management, and KVK blog publishing.
- **Auth:** Supabase JWT tokens — phone number as primary login
- **State:** ChatContext manages advisory session continuity

### 2.2 Layer 2 — Advisory (Dify RAG)
- **Dify Community Edition** (self-hosted) — RAG agent connected to FastAPI backend via HTTP API
  - Knowledge base: 6 curated agricultural markdown files ingested via Dify Dataset UI
  - Retrieval: Qdrant Cloud (Dify native `VECTOR_STORE`)
  - LLM (text): **Groq `Llama-3.1-8b-instant`**
  - LLM (vision): **OpenRouter `google/gemini-2.5-flash-image-preview:free`**
  - Fallback: Groq direct API call if Dify fails
- **Safety constraints:** explicit guardrails — refuses pesticide dosages, financial predictions, non-agricultural advice; defers to KVK

### 2.3 Layer 3 — Backend & Data (FastAPI + Supabase)
- **FastAPI** manages: authentication, request routing, farmer context assembly, ML service dispatch, STT/TTS, response logging
- **Supabase PostgreSQL** stores all structured data (20 migration schema)
- **Supabase Storage (S3)** stores binary files — soil images and pest images only
- **Supabase Auth** handles JWT issuance; phone-based OTP login
- **RLS** enabled on all tables and storage buckets

---

## 3. Request Data Flow (Single Advisory Turn)

```
1. Farmer submits input via PWA
   └── Text → enters pipeline directly
   └── Voice → Groq Whisper STT → transcribed text (audio discarded) → pipeline → gTTS response audio
   └── Image → ML microservice (soil or pest) → result appended to context

2. FastAPI assembles farmer context block:
   └── farmers table: name, language, location
   └── farms table: area, soil_type, irrigation_type
   └── crop_records: active crop, season, growth_stage, sowing_date
   └── expense_logs: last 30 days summarised by category
   └── Open-Meteo API: live weather for farmer's district
   └── ML output (if image uploaded)
   └── Latest soil scan data + crop recommendations (auto-injected)

3. FastAPI POSTs to Dify Chat API:
   └── farmer_input_text + context_block + ml_outputs

4. Dify RAG agent:
   └── Knowledge Retrieval (Qdrant) → LLM generation → safety evaluation

5. FastAPI:
   └── Returns response + gTTS audio to PWA
   └── Writes advisory_messages audit record
   └── Increments advisory_sessions.total_turns
```

---

## 4. ML Microservices

Each ML module is an independent FastAPI service. The backend dispatches to them and falls back to deterministic stubs when services are unavailable.

| Service | Port | Model | Input | Output |
|---|---|---|---|---|
| Soil Classifier | 8001 | YOLOv8n (Ultralytics) | Soil surface image | Soil class + confidence |
| Crop Recommender | 8002 | Random Forest (sklearn) | NPK, pH, temp, humidity, rainfall | Ranked crop list |
| Price Forecaster | 8003 | Prophet + rule-based | Crop name + district | UP/DOWN/STABLE signal |
| Plant Disease | 8004 | MobileNetV2 (HuggingFace) | Leaf/crop image | Disease name + confidence |

### ML Performance

| Module | Metric | Value |
|---|---|---|
| Soil Classification | F1 | 91.69% |
| Crop Recommendation | F1 | 89.94% |
| Season Detection | F1 | 87.37% |
| Price Forecasting | MAPE | 9.68% |
| RAG Faithfulness (Ragas) | vs Non-RAG (6.9%) | 94.5% |
| RAG Answer Relevancy | | 89.3% |
| Advisory Latency | P50 | 2.0 seconds |
| Pipeline Success Rate | | 100% (96/96 traces) |

---

## 5. Database Schema Overview

20 ordered migrations. Core tables with RLS on every table.

### Entity Relationships
```
auth.users
    └── farmers (1:1, id = auth UID)
            ├── farms (1:many)
            │       └── crop_records (1:many, one active per farm)
            │               ├── yield_records (1:1)
            │               ├── expense_logs (1:many)
            │               └── pest_scans (1:many)
            │
            ├── advisory_sessions (1:many)
            │       └── advisory_messages (1:many, immutable audit)
            │               ├── soil_scans (1:1)
            │               ├── pest_scans (1:1)
            │               ├── crop_recommendation_requests (1:1)
            │               └── price_forecast_requests (1:1)
            │
            ├── activity_logs (1:many)
            └── price_forecast_requests (1:many)

ref_crops / ref_locations / ref_knowledge_documents — read-only reference tables
```

### RLS Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `farmers` | Own row | Own row | Own row | ❌ |
| `farms` | Own rows | Own rows | Own rows | Own rows |
| `crop_records` | Own rows | Own rows | Own rows | ❌ |
| `expense_logs` | Own rows | Own rows | Own rows | Own rows |
| `activity_logs` | Own rows | Own rows | Own rows | Own rows |
| `advisory_sessions` | Own rows | Own rows | Own rows | ❌ |
| `advisory_messages` | Own rows | Own rows | ❌ | ❌ |
| `soil_scans` | Own rows | Service role | Service role | ❌ |
| `pest_scans` | Own rows | Service role | ❌ | ❌ |
| `crop_recommendation_requests` | Own rows | Service role | ❌ | ❌ |
| `price_forecast_requests` | Own rows | Service role | ❌ | ❌ |
| `ref_*` tables | All authenticated | Service role | Service role | Service role |

> "Own rows" = `auth.uid() = farmer_id`. "Service role" = backend service account only.

---

## 6. Storage Buckets

| Bucket | Path Convention | Retention | RLS |
|---|---|---|---|
| `soil-images` | `{farmer_id}/{farm_id}/{unix_ts}.jpg` | Permanent (training data) | Path prefix = `auth.uid()` |
| `pest-images` | `{farmer_id}/{crop_record_id}/{unix_ts}.jpg` | Permanent | Path prefix = `auth.uid()` |

**Voice audio is NEVER stored.** Whisper processes in memory and discards immediately.

---

## 7. Safety Guardrails

The advisory layer **will never**:
- Provide specific pesticide dosages or chemical formulations
- Make financial predictions or guaranteed market price forecasts
- Provide medical advice (farm animals or humans)
- Answer queries outside the agricultural domain

All deferral events logged: `advisory_messages.was_deferred_to_kvk = true`

---

## 8. Known Limitations

| Gap | Status | Improvement Path |
|---|---|---|
| Multilingual UI (Tamil/Telugu) | Planned | Schema supports it via `ref_crops` name columns + `farmers.preferred_language` |
| Context Recall 65% | Known | Semantic chunking; Top-K calibration |
| No field trial data | Planned | No real farmer cohort yet |
| Soil dataset small | Active | Each farmer upload is a training sample |
| Price MAPE 9.68% | Acceptable | Directional signal only, never exact price |

---

## 9. Behavioural Rules

1. Cloud LLMs are primary — no local Ollama required
2. Never store voice audio anywhere — memory-only, transcribe-and-discard
3. Never bypass RLS with service role key in application code
4. Always populate `advisory_messages.context_block_sent` and `retrieved_chunk_ids`
5. Validate `farmer_id` against `auth.uid()` before any write
6. Do not modify `ref_*` tables through application layer — migration-controlled only
7. Knowledge base ingestion via Dify Dataset UI — no custom Python scripts
8. When safety guardrail is ambiguous — defer to KVK and log
9. All new tables must include `farmer_id uuid FK → farmers.id` + RLS
10. Context assembly must remain single-pass read — no recursive queries

---

*solution.md v2.0 — updated 2026-04-26 to reflect production-ready state with live ML services, STT/TTS, and full advisory pipeline.*