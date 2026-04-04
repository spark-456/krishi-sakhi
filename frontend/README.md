# Frontend

React + Vite PWA for Krishi Sakhi.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Required Environment

Create `frontend/.env` with:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_DIFY_API_URL=http://localhost/v1
VITE_DIFY_CHATBOT_API_KEY=...
```

## Current Integration Reality

- The frontend currently talks directly to Supabase for app data.
- The chat screen currently talks directly to Dify from the browser.
- A FastAPI backend exists in `../backend`, but it is not yet the primary path for chat traffic.

## Important Files

- `src/lib/supabaseClient.js`: browser Supabase client
- `src/lib/difyClient.js`: browser Dify client
- `src/App.jsx`: route wiring
- `src/screens/`: feature screens
- `src/components/`: reusable UI and modal components

Refer to `../docs/ARCHITECTURE.md` for the current repo-level connection map.
