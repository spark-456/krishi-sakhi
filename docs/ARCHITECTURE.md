# Krishi Sakhi — Current Architecture

This document describes the repository as it exists now. It replaces older
`MIMIC_DEV` assumptions that no longer match the codebase.

## Current Runtime Topology

```text
React PWA (frontend/)
  |- Supabase JS client
  |    |- auth session
  |    |- farmers / farms / crop_records / expense_logs / activity_logs
  |
  |- Dify Chat API client
       |- sends query + assembled farmer context directly from the browser

FastAPI backend (backend/)
  |- scaffolded and callable locally
  |- owns context assembly, Dify proxying, audit writing, weather lookup
  |- not yet the primary path used by the frontend

Supabase schema SQL
  |- canonical SQL currently lives in supabase-gen-code/
  |- supabase/ is present but only contains placeholders

Dify export
  |- dify/chatflow - krishi sakhi.yml
```

## Connection Map

| Layer | Current State | Notes |
|---|---|---|
| Frontend -> Supabase | Active | Main app data path today |
| Frontend -> Dify | Active | `frontend/src/lib/difyClient.js` |
| Frontend -> FastAPI | Partial / not primary | Backend exists but chat is not routed through it yet |
| FastAPI -> Supabase | Implemented | Uses `supabase-py` clients |
| FastAPI -> Dify | Implemented | `backend/services/dify_client.py` |
| FastAPI -> Weather API | Implemented | `backend/services/weather_client.py` |
| `supabase/` folder -> live schema | Not authoritative | Placeholder layout only |
| `supabase-gen-code/` -> live schema | Authoritative in repo | SQL source set currently present |

## Source Of Truth Order

When files disagree, use this order:

1. Runtime code in `frontend/src/` and `backend/`
2. Schema contract in `docs/schema.md` plus SQL under `supabase-gen-code/`
3. High-level architecture in this file and `README.md`
4. `.agent-local/` status, handoff, and implementation plan files

Do not use external chat logs, external artifacts, or prior agent transcripts as
source of truth.

## Repository Layout

```text
.
|- frontend/            React + Vite PWA, active user-facing app
|- backend/             FastAPI service scaffold, not yet main request path
|- dify/                Dify flow export and related AI assets
|- docs/                Architecture, schema, and product references
|- ml/                  ML service area
|- supabase/            Placeholder migration/seed folders
|- supabase-gen-code/   Current SQL schema and reference data scripts
|- .agent/              Static role guidance
|- .agent-local/        Local-only operating memory and handoff state
```

## Safe Cleanup Rules

Safe to remove without architecture review:

- Generated Vite temp files
- Build outputs such as `frontend/dist/` and `/.dist/`
- Local error logs
- Unused template assets with no references

Do not remove or move without explicit review:

- Anything under `frontend/src/`, `backend/`, `dify/`, `docs/schema.md`
- SQL files under `supabase-gen-code/`
- Environment files
- Root planning docs unless their role is intentionally replaced

## Development Continuity Model

Persistent working memory should live in `.agent-local/` with this shape:

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
