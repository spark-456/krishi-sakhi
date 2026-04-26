# Krishi Sakhi — Current Architecture

> Last updated: 2026-04-26
> This document describes the repository as it exists now. It is the authoritative architecture reference.

## Current Runtime Topology

```text
React PWA (frontend/)
  |- Supabase JS client (Auth session management only)
  |- Backend API client (all feature traffic)
       |- All queries proxied through FastAPI backend

FastAPI backend (backend/)
  |- Routers: advisory, farms, crops, expenses, activity, ml_scans, ml_insights, auth, weather
  |- Services: context_assembler, dify_client, stt_service, tts_service, weather_client, qdrant_client, audit_writer, price_forecast_fallback
  |- Context assembly (farmer + farms + crops + expenses + weather + ML outputs)
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

Supabase (Cloud — ap-south-1)
  |- PostgreSQL: all structured data (20 migration schema)
  |- Auth: Phone OTP / JWT
  |- Storage S3: soil-images, pest-images buckets

ML Microservices (independent FastAPI services, ports 8001–8004)
  |- soil_classifier    → http://localhost:8001 (YOLOv8n, F1: 91.69%)
  |- crop_recommender   → http://localhost:8002 (Random Forest, F1: 89.94%)
  |- price_forecaster   → http://localhost:8003 (Prophet, MAPE: 9.68%)
  |- plant_disease      → http://localhost:8004 (MobileNetV2, 38 classes)
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
| FastAPI → ML services | Active with fallback | All 4 services called when available; deterministic stubs when down |
| Dify → Qdrant Cloud | Configured | `VECTOR_STORE=qdrant` in Dify environment |
| Dify → Groq LLM | Active | `Llama-3.1-8b-instant` for text queries |
| Dify → OpenRouter | Configured | `gemini-2.5-flash-image-preview:free` for image |

## Source Of Truth Order

When files disagree, use this order:

1. Runtime code in `frontend/src/` and `backend/`
2. Schema contract in `docs/schema.md` + SQL files under `supabase-gen-code/`
3. This file, `docs/solution.md`, and `README.md`

## Repository Layout

```text
.
|- frontend/            React + Vite PWA — active user-facing app
|- backend/             FastAPI service — active primary request path
|- dify/                Dify chatflow export (.yml)
|- kb/                  6 knowledge base markdown files (ingested into Dify Dataset)
|- docs/                Architecture, schema, and solution references
|- ml/                  ML microservice area (soil, crop, price, plant disease, legacy transcriber)
|- supabase/            Migration/seed placeholder folders
|- supabase-gen-code/   Authoritative SQL schema — 020 ordered migrations
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
| LLM (vision) | OpenRouter `gemini-2.5-flash-image-preview:free` | For image analysis |
| LLM (fallback) | Groq direct API | When Dify is unreachable |
| STT | Groq `whisper-large-v3-turbo` | Cloud, English |
| TTS | Google gTTS (`lang=en, tld=co.in`) | Indian English accent |
| Weather | Open-Meteo | Free, no API key |
| ML — Soil | YOLOv8n (Ultralytics) | Live service on port 8001 |
| ML — Crops | Random Forest (scikit-learn) | Live service on port 8002 |
| ML — Price | Prophet / rule-based | Live service on port 8003 |
| ML — Disease | MobileNetV2 (Hugging Face) | Live service on port 8004 |

## NOT In This Stack

- ❌ **n8n** — removed; data ingestion done via Dify Dataset UI
- ❌ **FAISS** — replaced by Qdrant Cloud as Dify's native vector store
- ❌ **Ollama** — removed; no local LLM required (Groq free tier is primary)
- ❌ **nomic-embed-text** — replaced by Dify's configured embedding provider
