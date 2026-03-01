# Frontend Engineer Skill — Krishi Sakhi PWA

> Read this fully before modifying any screen or component. Deviate only with a `// DEVIATION:` comment explaining why.

---

## 0. Pre-Flight Checklist

Before touching any file, answer these internally:

1. **Is this user-facing text?** → Do NOT hardcode strings. Put them in a language map (see Section 7). Tamil and Telugu support is planned.
2. **Does this screen initiate a network call?** → It must handle `loading`, `error`, and `offline` states — not just the happy path.
3. **Does this involve audio or image?** → Audio bytes must never be stored. Images must be compressed client-side before upload.
4. **Does this touch auth state?** → All protected screens must redirect to `/` if `session` is null.
5. **Is this a new screen?** → It needs a route in `App.jsx`, a lazy import, and an entry in the screen inventory (Section 2).

---

## 1. Stack & Conventions

| Concern | Solution | Notes |
|---|---|---|
| Framework | React 18 + Vite 5 | No Next.js — this is a pure SPA/PWA |
| Routing | React Router DOM v7 | `<BrowserRouter>` in `main.jsx` |
| Styling | TailwindCSS 3.4 | Always use design tokens, never raw hex/rgb |
| Icons | lucide-react | Only source of icons. No emoji in interactive UI |
| State (local) | `useState` / `useReducer` | For screen-local state |
| State (server) | Direct Supabase calls in hooks | No Redux, no Zustand until scale demands it |
| Forms | Uncontrolled with `useState` | No React Hook Form unless form is > 5 fields |
| File structure | `src/screens/` `src/components/` `src/hooks/` `src/lib/` | See Section 3 |

**File naming:** PascalCase for components and screens (`FarmerRegistrationFlow.jsx`). camelCase for hooks (`useSupabaseAuth.js`).

**Component pattern:** Function components only. No class components.

**JSX:** All files are `.jsx`. TypeScript is not in use — do not introduce it.

---

## 2. Screen Inventory

These are all existing screens. Do not duplicate their responsibility.

| Screen | Route | Auth Required | Backend Integration |
|---|---|---|---|
| `WelcomeScreen` | `/` | No | None |
| `PhoneNumberLogin` | `/login` | No | Supabase Phone OTP (pending) |
| `FarmerRegistrationFlow` | `/register` | Yes (new session) | `farmers` table INSERT (pending) |
| `HomeDashboard` | `/dashboard` | Yes | Weather API, farm summary |
| `MyFarmsAndCropsList` | `/farms` | Yes | `farms`, `crop_records` tables |
| `AddNewFarmScreen` | `/add-farm` | Yes | `farms` table INSERT |
| `AIAssistantChatScreen` | `/assistant` | Yes | FastAPI `/advisory/ask` (pending) |
| `FarmActivityLogs` | `/activity` | Yes | `advisory_messages`, `expense_logs` |
| `FarmFinanceTracker` | `/finance` | Yes | `expense_logs` table |
| `CropDiseaseDetectionCamera` | `/camera` | Yes | FastAPI `/soil/scan` or `/pest/scan` |

**Bottom navigation** (`BottomNavigation.jsx`) appears on all authenticated app screens. It links: Home, Farms, Ask Sakhi (center FAB), Logs, Profile.

---

## 3. Directory Layout

```
src/
├── lib/
│   └── supabaseClient.js        # Supabase client singleton — import from here everywhere
│
├── hooks/
│   ├── useAuth.js               # Wraps supabase.auth.getSession + onAuthStateChange
│   ├── useOffline.js            # navigator.onLine + window.offline event listener
│   ├── useVoiceRecorder.js      # MediaRecorder API wrapper — never stores audio
│   └── useImageCapture.js       # Camera/gallery picker + client-side compression
│
├── components/
│   ├── BottomNavigation.jsx     # Persistent bottom tab bar
│   ├── AuthGuard.jsx            # Wraps protected routes, redirects to / if no session
│   ├── OfflineBanner.jsx        # Sticky banner when navigator.onLine = false
│   └── ui/                      # Primitive UI: Spinner, ErrorState, EmptyState
│
├── screens/                     # One file per route (see Section 2)
└── i18n/
    └── strings.js               # All user-facing strings keyed by language
```

**Rule:** `supabaseClient.js` is the only place that calls `createClient`. Every other file imports `supabase` from there. Never instantiate two clients.

---

## 4. Supabase Client Pattern

```javascript
// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

**Note on env vars:** Vite exposes only vars prefixed `VITE_`. The root `.env` uses `SUPABASE_URL` (for backend). The frontend's `.env` must use `VITE_SUPABASE_URL`.

```javascript
// src/hooks/useAuth.js
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useAuth() {
  const [session, setSession] = useState(undefined) // undefined = loading, null = logged out

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return {
    session,
    user: session?.user ?? null,
    isLoading: session === undefined,
    isAuthenticated: Boolean(session),
  }
}
```

---

## 5. Auth Guard Pattern

```jsx
// src/components/AuthGuard.jsx
import { useAuth } from '../hooks/useAuth'
import { Navigate } from 'react-router-dom'

export function AuthGuard({ children }) {
  const { isLoading, isAuthenticated } = useAuth()

  if (isLoading) return <FullPageSpinner />
  if (!isAuthenticated) return <Navigate to="/" replace />
  return children
}
```

```jsx
// App.jsx — wrap protected routes
<Route path="/dashboard" element={
  <AuthGuard><><HomeDashboard /><BottomNavigation /></></AuthGuard>
} />
```

---

## 6. PWA-Specific Patterns

### Offline Detection

```javascript
// src/hooks/useOffline.js
import { useState, useEffect } from 'react'

export function useOffline() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setIsOffline(true)
    const goOnline = () => setIsOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  return isOffline
}
```

**Rule:** Every screen that makes a network call must show `<OfflineBanner />` when `useOffline()` returns true and must prevent the API call.

### Voice Recording (MediaRecorder)

```javascript
// src/hooks/useVoiceRecorder.js
// CRITICAL: audio chunks must never be written to Supabase Storage or any DB column.
// The audio blob is passed ONCE to the /advisory/transcribe endpoint and then GC'd.

export function useVoiceRecorder({ onTranscript }) {
  const [isRecording, setIsRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    chunksRef.current = []
    recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      stream.getTracks().forEach((t) => t.stop()) // release microphone
      chunksRef.current = []                      // clear memory immediately
      const formData = new FormData()
      formData.append('audio', blob)
      const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/v1/advisory/transcribe`, {
        method: 'POST',
        body: formData,
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      })
      const { text } = await res.json()
      onTranscript(text) // blob is now GC'd — text enters chat pipeline
    }
    recorder.start()
    mediaRecorderRef.current = recorder
    setIsRecording(true)
  }

  const stop = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  return { isRecording, start, stop }
}
```

### Image Compression Before Upload

```javascript
// src/hooks/useImageCapture.js
// Compress before sending — low-end phones produce 6–12MB images.
// Target: <800KB, max 1024px on longest side.

export async function compressImage(file, maxSizePx = 1024, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, maxSizePx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = img.width * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(resolve, 'image/jpeg', quality)
      URL.revokeObjectURL(img.src)
    }
  })
}
```

---

## 7. Design System

### Color Tokens (existing — do not add new raw colors)

All colors come from CSS custom properties mapped in `tailwind.config.js`:

| Token | Usage |
|---|---|
| `bg-primary` / `text-primary` | Green action buttons, active nav, headers |
| `text-primary-foreground` | White text on green backgrounds |
| `bg-secondary` / `text-secondary-foreground` | Muted backgrounds, secondary buttons |
| `bg-muted` / `text-muted-foreground` | Placeholder text, disabled states |
| `bg-destructive` / `text-destructive-foreground` | Errors, delete actions |
| `bg-background` | Page backgrounds |
| `border-border` | Card and input borders |

**Rule:** Never use raw Tailwind colors like `bg-green-600` in new code. Always use the semantic tokens above. The existing `bg-green-600` in `BottomNavigation.jsx` is legacy — do not copy it.

### Spacing and Layout

- **Mobile container:** `max-w-md w-full` centered via `flex justify-center` in `App.jsx`. Never break out of this.
- **Safe area bottom:** Input bars must use `pb-safe` or `pb-8` for Android home indicator.
- **Page padding:** `p-6` or `px-4 py-4` consistently.
- **Cards:** `bg-white rounded-2xl shadow-sm border border-slate-100 p-6`

### Animation Conventions

```jsx
// Entering content
<div className="animate-in fade-in slide-in-from-bottom-4 duration-500">...</div>

// Skeleton loading
<div className="animate-pulse bg-secondary rounded-xl h-4 w-2/3" />
```

---

## 8. Chat Screen Integration Contract

`AIAssistantChatScreen.jsx` currently uses a mock. When integrating with the real backend:

```javascript
// Message shape — UI depends on these exact fields
const message = {
  id: crypto.randomUUID(),     // not Date.now()
  sender: 'user' | 'ai',
  text: string,
  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  suggestions: string[],       // AI messages only, optional
}

// API payload — matches FastAPI POST /api/v1/advisory/ask
const payload = {
  session_id: string,          // UUID — must be from advisory_sessions table
  input_channel: 'text' | 'voice' | 'image',
  farmer_input_text: string,
  farm_id: string | null,      // required when input_channel === 'image'
  crop_record_id: string | null,
}
```

**Typing indicator:** While awaiting the API, add a skeleton AI message with `isTyping: true`. Remove it on response. Never use `setTimeout` as fake loading in production.

---

## 9. Registration Flow Contract

`FarmerRegistrationFlow.jsx` must write to the `farmers` table after OTP verification:

```javascript
const { error } = await supabase.from('farmers').insert({
  id: session.user.id,          // MUST equal auth.users.id — violating this breaks all RLS
  full_name: formData.name,
  preferred_language: 'english',
  state: formData.state,
  district: formData.district,
  village: formData.village,
  onboarding_complete: true,
})

if (error) {
  // Show error in UI — do NOT navigate away on failure
  return
}

navigate('/dashboard', { replace: true })
```

---

## 10. Error, Loading, and Empty States

Every network-dependent section must implement all three. Use these patterns:

```jsx
// Loading
<div className="animate-pulse space-y-3">
  <div className="bg-secondary rounded-xl h-5 w-1/2" />
  <div className="bg-secondary rounded-xl h-5 w-full" />
</div>

// Error
<div className="flex flex-col items-center gap-3 py-12 text-center">
  <span className="text-4xl">⚠️</span>
  <p className="font-semibold text-slate-700">Something went wrong</p>
  <p className="text-sm text-muted-foreground">{errorMessage}</p>
  <button onClick={retry} className="text-primary text-sm font-semibold underline">Try again</button>
</div>

// Empty
<div className="flex flex-col items-center gap-3 py-16 text-center">
  <span className="text-5xl">🌱</span>
  <p className="font-semibold text-slate-700">{emptyTitle}</p>
  <p className="text-sm text-muted-foreground">{emptyDescription}</p>
</div>
```

---

## 11. i18n Pattern (Future-Ready)

Do not hardcode display strings. Use the strings map from day one:

```javascript
// src/i18n/strings.js
export const strings = {
  english: {
    welcome_title: 'Welcome to Krishi Sakhi',
    login_cta: 'Get OTP',
    chat_placeholder: 'Type your farming question...',
    offline_banner: 'You are offline. Advisory is unavailable.',
  },
  tamil: {
    welcome_title: 'கிருஷி சக்தியில் வரவேற்கிறோம்',
  },
  telugu: {},
}

// Usage
const lang = user?.user_metadata?.preferred_language ?? 'english'
const t = strings[lang]
// <h1>{t.welcome_title}</h1>
```

---

## 12. Adding a New Screen — Checklist

```
1. Create src/screens/MyNewScreen.jsx
2. Add lazy import in App.jsx:
   const MyNewScreen = lazy(() => import('./screens/MyNewScreen'))
3. Add route in App.jsx — wrap with <AuthGuard> if protected
4. If it shows bottom nav: <><MyNewScreen /><BottomNavigation /></>
5. Add it to the Screen Inventory table in Section 2 above
6. Add all user-facing strings to src/i18n/strings.js
7. Implement loading, error, and offline states before marking done
```

---

## 13. Performance Rules

| Rule | Reason |
|---|---|
| Lazy-load all screen components | Reduce initial JS parse on low-end devices |
| Compress images before upload | 2G connections + 512MB RAM phones |
| Never autoplay audio | Battery + data cost |
| Debounce search inputs (300ms) | Avoid excessive fetches on slow connections |
| Use native `Intl.DateTimeFormat` — no moment.js / date-fns | ~80KB bundle saving |
| No JS scroll libraries — native `scrollIntoView` only | Avoid bundle bloat |

---

*frontend-engineer.md v1.0 — Krishi Sakhi PWA engineering standard*
*Update this document before adding new screens, hooks, or API integrations.*
