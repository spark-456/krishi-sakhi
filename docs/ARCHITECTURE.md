# Krishi Sakhi — Current Architecture

> Last updated: 2026-04-20
> This document describes the repository as it exists now. It is the authoritative architecture reference.

## Current Runtime Topology

```text
React PWA (frontend/)
  |- Supabase JS client (Auth session management only)
  |- Backend API client (all feature traffic)
       |- All queries proxied through FastAPI backend

FastAPI backend (backend/)
  |- Primary request path
  |- Context assembly (farmer + farms + crops + expenses + weather)
  |- Dify proxying (RAG advisory via Dify Chat API)
  |- STT via Groq whisper-large-v3-turbo
  |- TTS via Google gTTS (Indian English)
  |- ML scan dispatch (soil_classifier, crop_recommender, price_forecaster, plant_disease_classifier)
  |- Audit writing to advisory_messages (service role)

Dify (RAG Chatbot — Community Edition, self-hosted)
  |- Chatflow: START → IF/ELSE (image check) → Knowledge Retrieval → LLM → Answer
  |- LLM: Groq Llama-3.1-8b-instant (text) / OpenRouter Gemini 2.5 Flash (vision/image)
  |- Vector Store: Qdrant Cloud (VECTOR_STORE=qdrant in Dify env)
  |- Knowledge Base: 6 KB markdown files ingested via Dify Dataset UI
  |- Export: dify/chatflow - krishi sakhi.yml

Supabase (Cloud — ap-south-1)
  |- PostgreSQL: all structured data (farmers, farms, crops, expenses, advisory, ML outputs)
  |- Auth: Phone OTP / JWT
  |- Storage S3: soil-images, pest-images buckets

ML Microservices (independent FastAPI services, ports 8001–8005)
  |- soil_classifier    → http://localhost:8001 (YOLOv8n)
  |- crop_recommender   → http://localhost:8002 (Random Forest)
  |- price_forecaster   → http://localhost:8003 (Prophet / rule-based)
  |- plant_disease      → http://localhost:8004 (Hugging Face MobileNetV2)
  |- transcriber        → http://localhost:8005 (legacy; Groq Whisper is currently in backend directly)
```

## Connection Map

| Layer | Current State | Notes |
|---|---|---|
| Frontend → Supabase | Auth only | Session management, not data queries |
| Frontend → FastAPI | Active primary | All feature traffic goes through backend |
| FastAPI → Supabase | Implemented | `supabase-py` clients (anon + service role) |
| FastAPI → Dify | Implemented | `backend/services/dify_client.py` |
| FastAPI → Weather API | Implemented | `backend/services/weather_client.py` → Open-Meteo |
| FastAPI → Groq STT | Implemented | `backend/services/stt_service.py` |
| FastAPI → gTTS | Implemented | `backend/services/tts_service.py` |
| FastAPI → ML services | Active with fallback | Soil/crop/price/disease services are called when available; deterministic stubs protect the app when a service is down |
| Dify → Qdrant Cloud | Configured | `VECTOR_STORE=qdrant` in Dify environment |
| Dify → Groq LLM | Active | `Llama-3.1-8b-instant` for text queries |
| Dify → OpenRouter | Configured | `google/gemini-2.5-flash-image-preview:free` for image |

## Source Of Truth Order

When files disagree, use this order:

1. Runtime code in `frontend/src/` and `backend/`
2. Schema contract in `docs/schema.md` + SQL files under `supabase-gen-code/`
3. This file and `README.md`
4. `MASTER_IMPLEMENTATION_PLAN.md` — task checklist, reflects pending work

## Repository Layout

```text
.
|- frontend/            React + Vite PWA — active user-facing app
|- backend/             FastAPI service — active primary request path
|- dify/                Dify chatflow export (.yml) and KB directory reference
|- kb/                  6 knowledge base markdown files (ingested into Dify Dataset)
|- docs/                Architecture, schema, and product references
|- ml/                  ML microservice area (soil, crop, price, plant disease, legacy transcriber)
|- supabase/            Migration/seed placeholder folders (see supabase-gen-code/ for SQL)
|- supabase-gen-code/   Authoritative SQL schema — 018 ordered migrations
|- pavan-drive-ml/      Training assets (colab notebooks, datasets, saved models) — not deployed
```

## Tech Stack (Current — As-Built)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite (PWA) | TailwindCSS, lucide-react, react-router-dom |
| Backend | FastAPI (Python) | uvicorn, supabase-py, httpx |
| Auth | Supabase Auth — Phone OTP | JWT forwarded to backend on every request |
| Database | Supabase PostgreSQL (Cloud) | RLS on all tables |
| Storage | Supabase S3 (Cloud) | soil-images, pest-images buckets |
| RAG | Dify Community Edition | Chatflow with Knowledge Retrieval node |
| Vector DB | Qdrant Cloud | Dify's native VECTOR_STORE |
| KB | 6 markdown files in `kb/` | Ingested via Dify Dataset UI |
| LLM (text) | Groq `Llama-3.1-8b-instant` | Fast, free tier |
| LLM (vision) | OpenRouter `gemini-2.5-flash-image-preview:free` | For image analysis path |
| STT | Groq `whisper-large-v3-turbo` | Cloud, English only currently |
| TTS | Google gTTS (`lang=en, tld=co.in`) | Indian English accent |
| Weather | Open-Meteo | Free, no API key |
| ML — Soil | YOLOv8n (Ultralytics) | Stub in backend, model in pavan-drive-ml |
| ML — Crops | Random Forest (scikit-learn) | Stub in backend |
| ML — Price | Prophet / rule-based | Stub in backend |

## NOT In This Stack

The following were considered and explicitly excluded:

- ❌ **n8n** — removed; data ingestion done via Dify Dataset UI
- ❌ **FAISS** — replaced by Qdrant Cloud as Dify's native vector store
- ❌ **Ollama** — removed; no local LLM required (Groq free tier is primary)
- ❌ **nomic-embed-text** — replaced by Dify's configured embedding provider

## Safe Cleanup Rules

Safe to remove without architecture review:
- Generated Vite temp files
- Build outputs such as `frontend/dist/` and `/.dist/`
- Local error logs

Do not remove or move without explicit review:
- Anything under `frontend/src/`, `backend/`, `dify/`, `kb/`, `docs/schema.md`
- SQL files under `supabase-gen-code/`
- Environment files
- `MASTER_IMPLEMENTATION_PLAN.md`

## Development Continuity Model

Persistent working memory lives in `.agent-local/` with this shape:

```text
.agent-local/
|- context/     system map, repo inventory, cleanup notes
|- state/       active status and next-session handoff
|- decisions/   architecture and workflow decisions
|- logs/        dated change log
|- plans/       prioritized backlog
|- templates/   repeatable update templates
```

Rules:
- Update `.agent-local/state/ACTIVE_STATUS.md` after meaningful repo changes.
- Update `.agent-local/state/HANDOFF.md` before ending a session.
- Log decisions instead of hiding them inside chat history.
- Prefer concise factual notes over speculative plans.
