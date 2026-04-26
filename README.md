# 🌾 Krishi Sakhi — *Farmer's Friend*

> An AI-powered Agricultural Decision Support Platform for smallholder farmers in India.


<p align="center">
  <img src="frontend/public/screenshots/Get-started.png" width="30%" />
  <img src="frontend/public/screenshots/Dashboard-new.png" width="30%" />
  <img src="frontend/public/screenshots/Log-phone.png" width="30%" />
</p>


---

## The Problem

India's agricultural extension worker-to-farmer ratio has fallen below **1 : 5,000**. Smallholder farmers make high-stakes decisions on crop selection, pest management, irrigation, and market timing **without any structured expert guidance**. Public extension services require travel and time most farmers simply cannot afford.

**Krishi Sakhi** fills that gap — a single AI-assisted interface, operable on low-end smartphones under intermittent connectivity.

---

## What It Does

| Capability | How |
|---|---|
| 🗣️ Conversational advisory | Ask questions in text or voice; get grounded, RAG-backed answers via Dify + Qdrant |
| 🌱 Crop recommendations | Soil NPK + weather inputs → ranked crop list from a Random Forest model |
| 🪲 Pest / disease detection | Upload a photo → MobileNetV2 classifies likely crop disease |
| 📈 Price forecasting | Prophet time-series model gives 7–14 day directional mandi signals (UP/DOWN/STABLE) |
| 🌦️ Live weather context | Open-Meteo integrated into every advisory query automatically |
| 🔒 Safety guardrails | Never gives pesticide dosages, financial guarantees, or medical advice |

---

## System Architecture

```
┌─────────────────────── Client (PWA) ───────────────────────┐
│  React + Vite · Offline-capable · Android-installable       │
│  Input: Text  |  Voice (MediaRecorder)  |  Image            │
└────────────────────────────┬───────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼───────────────────────────────┐
│              Backend  (FastAPI · Python)                     │
│  • Auth via Supabase JWT (Phone OTP)                        │
│  • Assembles farmer context block from DB + weather API     │
│  • STT via Groq whisper-large-v3-turbo (cloud)              │
│  • TTS via Google gTTS (Indian English)                     │
│  • Dispatches to ML microservices                           │
│  • POSTs context + query directly to Dify Chat API          │
│  • Writes full audit record to Supabase                     │
└──────┬────────────────────────────────┬────────────────────┘
       │                                │
┌──────▼──────┐                 ┌───────▼───────────────────┐
│  Supabase   │                 │  Dify (RAG Agent)          │
│  PostgreSQL │                 │  Qdrant Cloud vector DB    │
│  Auth / S3  │                 │  Groq Llama-3.1-8b-instant │
│  RLS on all │                 │  (text) + Gemini (vision)  │
│  tables     │                 └───────────────────────────┘
└─────────────┘
       │
┌──────▼────────────────────────────────────────────────────┐
│  ML Microservices  (each an independent FastAPI service)   │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ YOLOv8n     │ │ Random Forest│ │ Prophet Forecaster │  │
│  │ Soil        │ │ Crop Rec.    │ │ Mandi Prices       │  │
│  │ F1: 91.69%  │ │ F1: 89.94%  │ │ MAPE: 9.68%        │  │
│  └─────────────┘ └──────────────┘ └────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐ │
│  │ MobileNetV2 Plant Disease Classifier (38 classes)    │ │
│  └──────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────┘
```

---

## Request Flow (single advisory turn)

```
Farmer input (text / voice / image)
    │
    ├─ Voice  → Groq Whisper STT → transcribed text (audio discarded immediately)
    ├─ Image  → soil or plant disease model → class + confidence appended to context
    └─ Text   → enters pipeline directly
    │
    ▼
FastAPI assembles context block:
    farmers (name, district, language)
    + farms (area, soil_type, irrigation)
    + crop_records (active crop, growth stage)
    + expense_logs (last 30 days, by category)
    + Open-Meteo (live weather for district)
    + ML output (if image was sent)
    │
    ▼
POST to Dify Chat API
    Dify: Knowledge Retrieval (Qdrant) → LLM generation
    Safety guardrail evaluation
    │
    ▼
FastAPI: gTTS converts response text → Base64 audio
FastAPI writes advisory_messages (full audit record)
    │
    ▼
Response returned to PWA → displayed + played to farmer
```

---

## ML Model Performance

| Model | Metric | Score |
|---|---|---|
| Soil Classification (YOLOv8n) | F1 | **91.69%** |
| Crop Recommendation (Random Forest) | F1 | **89.94%** |
| Season Detection | F1 | **87.37%** |
| Price Forecasting (Prophet) | MAPE | **9.68%** |
| RAG Faithfulness (Ragas) | vs. Non-RAG 6.9% | **94.5%** |
| RAG Answer Relevancy | | **89.3%** |
| Advisory Latency | P50 | **2.0 s** |
| Pipeline Success Rate | | **100% (96/96 traces)** |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite (PWA, Android-installable) |
| Backend API | FastAPI (Python) |
| Database | Supabase PostgreSQL (Cloud, `ap-south-1`) |
| Auth | Supabase Auth — Phone OTP |
| File Storage | Supabase S3 (soil-images, pest-images) |
| RAG Agent | Dify Community Edition (self-hosted) |
| Vector Search | Qdrant Cloud |
| Embeddings | Dify-managed embedding provider |
| LLM (primary) | Groq — `Llama-3.1-8b-instant` |
| LLM (vision) | OpenRouter — `google/gemini-2.5-flash-image-preview:free` |
| LLM (fallback) | Groq direct API call if Dify fails |
| Voice STT | Groq `whisper-large-v3-turbo` (cloud, English) |
| Voice TTS | Google gTTS (Indian English — `tld=co.in`) |
| Soil ML | YOLOv8n (Ultralytics) |
| Pest / Disease ML | Hugging Face MobileNetV2 image classifier |
| Crop ML | Random Forest (scikit-learn) |
| Price ML | Prophet (Meta) |
| Weather | Open-Meteo (free, no key) |
| Mandi Data | data.gov.in (open government) |
| Containers | Docker Compose |

---

## Quick Start (Local Development)

### Prerequisites
- Python 3.11+ with venv
- Node.js 18+
- Supabase project (configured in `.env`)
- Dify instance running (local or cloud)
- Groq API key

### Backend

```bash
cd backend
# Activate virtualenv
.\venv\Scripts\Activate.ps1       # Windows
source venv/bin/activate           # macOS/Linux

# Copy and configure environment
cp .env.example .env               # Edit with your keys (root .env is also read)

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: http://localhost:8000
API docs at: http://localhost:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend will be available at: http://localhost:5173

---

## Project Structure

```
/
├── frontend/          # React + Vite PWA
│   └── src/
│       ├── screens/   # All app screens (Dashboard, Chat, Farms, Camera, etc.)
│       ├── components/ # Shared UI components + modals
│       ├── hooks/     # useAuth, useVoiceRecorder
│       └── lib/       # backendClient.js, supabaseClient.js
│
├── backend/           # FastAPI application
│   ├── routers/       # advisory, farms, crops, expenses, activity, ml_scans, auth, weather
│   ├── services/      # context_assembler, dify_client, stt_service, tts_service, weather_client
│   ├── models/        # Pydantic schemas
│   └── requirements.txt
│
├── ml/
│   ├── soil_classifier/   # YOLOv8n FastAPI service (port 8001)
│   ├── crop_recommender/  # Random Forest FastAPI service (port 8002)
│   ├── price_forecaster/  # Prophet FastAPI service (port 8003)
│   ├── plant_disease_classifier/ # Hugging Face MobileNetV2 service (port 8004)
│   └── transcriber/       # Legacy (STT now handled by backend directly via Groq)
│
├── dify/              # Dify chatflow exports
├── kb/                # 6 knowledge base markdown files (ingested into Dify Dataset)
├── supabase-gen-code/ # Authoritative SQL migrations (001–018)
├── docs/              # Architecture, schema, context references
└── docker-compose.yml
```

---

## Database Overview

18 ordered migrations create the full schema. Core tables:

- **`farmers`** — profile, language, location (RLS: own row only)
- **`farms`** — land parcels with soil/irrigation info
- **`crop_records`** — active/past crops per farm (one active per farm enforced)
- **`expense_logs`** — categorised farm expenses
- **`advisory_sessions` + `advisory_messages`** — full immutable audit trail of every AI interaction
- **`soil_scans` / `pest_scans`** — ML outputs + S3 image paths (permanent, used for retraining)
- **`crop_recommendation_requests` / `price_forecast_requests`** — ML query logs
- **`ref_crops` / `ref_locations` / `ref_knowledge_documents`** — read-only reference tables

> **RLS is enabled on every table.** Farmers can only access their own rows. ML output tables are service-role-insert-only.

---

## Safety Guardrails

The Dify agent **will never**:
- Provide specific pesticide dosages or chemical formulations
- Make financial predictions or guarantee market prices
- Provide medical advice (humans or animals)
- Answer queries outside the agricultural domain

All unsafe queries are deferred to the nearest **Krishi Vigyan Kendra (KVK)** and the deferral is logged (`advisory_messages.was_deferred_to_kvk = true`).

---

## Data Privacy

- 🔇 **Voice audio is never stored** — Groq Whisper processes in memory and discards immediately
- 🔒 **All storage buckets** enforce farmer-scoped path RLS (`path LIKE auth.uid() || '%'`)
- 🚫 **Service role key** is only used for ML output table inserts and audit logging — never in user-facing code

---

## Environment Variables

See `backend/.env.example` and `frontend/.env.example` for full reference.

Key variables:
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `DIFY_API_URL`, `DIFY_API_KEY`
- `GROQ_API_KEY` — STT (Whisper) and LLM fallback
- `QDRANT_URL`, `QDRANT_API_KEY` — for Dify's vector store configuration

---

## Current Implementation Status

> See `MASTER_IMPLEMENTATION_PLAN.md` for the full task checklist.

| Component | State |
|---|---|
| Frontend (React+Vite) | ✅ Live — all screens present |
| Backend (FastAPI) | ✅ Active — all routers, context assembly, STT/TTS |
| Advisory Pipeline | ✅ Working — FastAPI → Dify → gTTS → response |
| STT | ✅ Groq `whisper-large-v3-turbo` with 10s timeout |
| TTS | ✅ gTTS Indian English with 8s timeout |
| Dify RAG Chatflow | ⚠️ Partial — workflow built, KB ingestion in progress |
| Qdrant Vector DB | ⚠️ Configured in `.env` — linked to Dify |
| ML Services | ⚠️ Stub endpoints — real models in `pavan-drive-ml/` |
| Camera Screen | ⚠️ File input present — static preview, no real camera |
| Weather Dashboard | ⚠️ API integrated — dashboard still shows hardcoded values |

---

*For architecture detail, schema constraints, RLS rules, and implementation tasks — see [`MASTER_IMPLEMENTATION_PLAN.md`](./MASTER_IMPLEMENTATION_PLAN.md) and [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).*
