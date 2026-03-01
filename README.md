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
| 🗣️ Conversational advisory | Ask questions in text or voice; get grounded, RAG-backed answers |
| 🌱 Crop recommendations | Soil NPK + weather inputs → ranked crop list from a Random Forest model |
| 🪲 Pest / disease detection | Upload a photo → YOLOv8n classifies soil type or pest |
| 📈 Price forecasting | Prophet time-series model gives 7–14 day directional mandi signals |
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
│  • Dispatches to ML microservices                           │
│  • POSTs context + query directly to Dify Chat API          │
│  • Writes full audit record to Supabase                     │
└──────┬────────────────────────────────┬────────────────────┘
       │                                │
┌──────▼──────┐                 ┌───────▼───────────────────┐
│  Supabase   │                 │  Dify (RAG Agent)          │
│  PostgreSQL │                 │  FAISS vector search        │
│  Auth / S3  │                 │  nomic-embed-text embeds   │
│  RLS on all │                 │  Cloud LLM (Groq primary)  │
│  tables     │                 │  Llama 3.1 8B (fallback)   │
└─────────────┘                 └───────────────────────────┘
       │
┌──────▼────────────────────────────────────────────────────┐
│  ML Microservices  (each an independent FastAPI service)   │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────────┐  │
│  │ YOLOv8n     │ │ Random Forest│ │ Prophet Forecaster │  │
│  │ Soil/Pest   │ │ Crop Rec.    │ │ Mandi Prices       │  │
│  │ F1: 91.69%  │ │ F1: 89.94%  │ │ MAPE: 9.68%        │  │
│  └─────────────┘ └──────────────┘ └────────────────────┘  │
│  ┌─────────────┐ ┌──────────────┐                          │
│  │ Whisper 74M │ │ Season Det.  │                          │
│  │ Voice Trans.│ │ F1: 87.37%  │                          │
│  └─────────────┘ └──────────────┘                          │
└───────────────────────────────────────────────────────────┘
```

---

## Request Flow (single advisory turn)

```
Farmer input (text / voice / image)
    │
    ├─ Voice  → Whisper microservice → transcribed text (audio discarded)
    ├─ Image  → YOLOv8n / pest model → class + confidence appended to context
    └─ Text   → enters pipeline directly
    │
    ▼
FastAPI assembles context block:
    farmers (name, district, language)
    + farms (area, soil_type, irrigation)
    + crop_records (active crop, growth stage)
    + expense_logs (last 30 days, by category)
    + Open-Meteo (live weather)
    + ML output (if image was sent)
    │
    ▼
POST to Dify Chat API
    Dify: FAISS metadata-filtered search → Cloud LLM generation
    Safety guardrail evaluation
    │
    ▼
FastAPI writes advisory_messages (full audit record)
    │
    ▼
Response returned to PWA → displayed to farmer
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
| Vector Search | FAISS |
| Embeddings | nomic-embed-text via Ollama |
| LLM (primary) | Cloud API — Groq / OpenRouter |
| LLM (fallback) | Llama 3.1 8B via Ollama (local) |
| Voice | Whisper base 74M (local, memory-only) |
| Soil / Pest ML | YOLOv8n (Ultralytics) |
| Crop ML | Random Forest (scikit-learn) |
| Price ML | Prophet (Meta) |
| Weather | Open-Meteo (free, no key) |
| Mandi Data | data.gov.in (open government) |
| Containers | Docker Compose |

---

## Project Structure

```
/
├── frontend/          # React + Vite PWA
│   └── src/
│       ├── screens/   # Onboarding, AskSakhi, FarmRecords, ExpenseLog
│       ├── components/
│       └── hooks/     # Supabase client, auth, voice recorder
│
├── backend/           # FastAPI application
│   ├── routers/       # advisory, farms, crops, expenses, auth
│   ├── services/      # context_assembler, ml_dispatcher, weather
│   └── models/        # Pydantic schemas
│
├── ml/
│   ├── soil_classifier/   # YOLOv8n FastAPI service
│   ├── crop_recommender/  # Random Forest FastAPI service
│   ├── price_forecaster/  # Prophet FastAPI service
│   └── transcriber/       # Whisper FastAPI service
│
├── dify/              # Dify chatflow exports + KB ingestion scripts
├── supabase/
│   ├── migrations/    # 001–019 ordered SQL migrations
│   └── seed/          # ref_crops, ref_locations data
│
└── docker-compose.yml
```

---

## Database Overview

19 ordered migrations create the full schema. Core tables:

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

- 🔇 **Voice audio is never stored** — Whisper processes in memory and discards immediately
- 🔒 **All storage buckets** enforce farmer-scoped path RLS (`path LIKE auth.uid() || '%'`)
- 🚫 **Service role key** is never used in application code — migrations and admin tooling only

---

## 🚀 Future Ideas

### More ML Models

| Idea | Model Approach | Value |
|---|---|---|
| **Irrigation scheduler** | LSTM on weather + soil moisture time-series | Tell farmers exactly when and how much to irrigate |
| **Yield predictor** | XGBoost on historical crop_records + weather | Pre-harvest yield estimates to plan storage / selling |
| **Pest outbreak early warning** | Anomaly detection on aggregated `pest_scans` across a district | Community-level alerts before an outbreak spreads |
| **Fertiliser optimiser** | Multi-objective optimisation on NPK + soil + crop | Minimise input cost, maximise yield — crop-specific dosing |
| **Credit risk scoring** | Gradient Boosting on expense/yield history | Help farmers access microloans using their own farm data as proof |
| **Multilingual NLP** | Fine-tuned IndicBERT / MuRIL | Native Tamil / Telugu query understanding without translation step |
| **Plant health from leaf images** | EfficientNet disease classifier | Expand beyond pest detection to nutrient deficiency, fungal disease |

---

### 🕸️ Farmer Community Graph *(Experimental)*

> The core idea: smallholder farmers are isolated. Individually, they have **no negotiating power**. Collectively — growing the same crop, in the same region, at the same time — they could sell together, buy inputs together, and share real-world knowledge. A graph makes those invisible connections visible.

**How it could work:**

```
Every farmer is a node. Edges form when farmers share:

  ┌─────────┐          ┌─────────┐
  │ Farmer A│──crop────│ Farmer B│   (both growing paddy, Kharif)
  └────┬────┘          └────┬────┘
       │                    │
     district             tools
       │                    │
  ┌────▼────┐          ┌────▼────┐
  │ Farmer C│──region──│ Farmer D│   (same block, soil type)
  └─────────┘          └─────────┘
```

**Edge types (similarity dimensions):**
- **Same crop + same season** → collective selling / input procurement group
- **Same district + same crop** → local mandi price intelligence sharing
- **Same soil type + same irrigation** → relevant advisory cross-pollination
- **Similar farm size + similar expense patterns** → peer comparison and benchmarking

**What it unlocks:**
- 🤝 **Collective bargaining** — "6 farmers in your block are also harvesting tomatoes this week. Form a group to negotiate with traders."
- 📦 **Bulk input buying** — pool orders for seeds/fertiliser to get wholesale rates
- 🧠 **Peer knowledge** — "A farmer 12 km from you with the same soil type tried drip irrigation. Here's what happened."
- 📊 **Crowdsourced mandi intelligence** — real sale prices reported by farmers in your network, not just official data
- 🚨 **Outbreak propagation alerts** — pest report in one node triggers early warnings for connected nodes

**Tech approach (exploratory):**
- Graph stored in **Neo4j** or **PostgreSQL with pgvector + recursive CTEs**
- Similarity computed from existing `farmers`, `farms`, `crop_records` data — no extra farmer input needed
- Community detection (Louvain algorithm) to surface natural farmer clusters
- Graph edges weighted and decayed over time (a connection via an old crop is weaker than a current one)
- PWA surfaces this as a **"Farmers near you growing the same crop"** feed — opt-in, privacy-preserving

> ⚠️ *This is an experimental concept. Privacy, trust, and user consent design would need to come first before any implementation. Farmers must opt in explicitly.*

---

## Current Status

> Research prototype — evaluated, **not yet in field trial**

Known gaps: multilingual UI (Tamil/Telugu planned), RAG context recall at 65% (semantic chunking improvement path identified), no real farmer cohort data yet.

---

## 🌍 A Note to End On

Krishi Sakhi started with one question: *what if every farmer had a knowledgeable friend they could call, any time, in their own language, for free?*

We're not there yet — but the foundation is real, the models work, and the data pipeline is live. Every soil photo a farmer uploads makes the classifier smarter. Every advisory turn logged makes the RAG system more auditable. Every edge we draw in a farmer graph brings isolated growers a little closer together.

The problems are hard. The farmers are resilient. The technology is ready to help.

**There's a lot of road ahead — and we're excited to walk it. 🌱**

---

*For architecture detail, schema constraints, RLS rules, and agent behavioural rules — see [`solution.md`](./docs/solution.md) and [`context.md`](./docs/context.md).*
