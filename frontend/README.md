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

`VITE_API_BASE_URL` is optional. If you omit it, the frontend derives the backend host from the current browser URL and targets port `8000`. This is the recommended local/LAN setup because it keeps working when your laptop IP changes between networks.

If you need a fixed override, add:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Current Integration Reality

- The frontend talks exclusively to the FastAPI backend located in `../backend`.
- The FastAPI backend handles all interactions with Supabase (DB/Auth) and Dify (Chat).

## Important Files

- `src/lib/supabaseClient.js`: browser Supabase client
- `src/lib/difyClient.js`: browser Dify client
- `src/App.jsx`: route wiring
- `src/screens/`: feature screens
- `src/components/`: reusable UI and modal components

Refer to `../docs/ARCHITECTURE.md` for the current repo-level connection map.
