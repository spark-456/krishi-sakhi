# Krishi Sakhi — Architecture (Mimic Dev)

> **MIMIC_DEV**: This is demo-quality code. All patterns marked `MIMIC_DEV:` are designed for easy rework to production Supabase later.

## File Structure

```
frontend/src/
├── lib/
│   ├── localDB.js          # localStorage-backed DB (Supabase API shape)
│   ├── supabaseClient.js    # Proxy: exports localDB as `supabase`
│   ├── difyClient.js        # Dify Chat API client with farmer context
│   └── reverseGeocode.js    # Nominatim GPS → state/district/village
├── hooks/
│   └── useAuth.js           # Auth hook (localStorage session)
├── components/
│   ├── AuthGuard.jsx        # Route protection
│   ├── BottomNavigation.jsx # Tab bar (5 tabs)
│   └── ui/Spinner.jsx       # Reusable spinner
├── screens/
│   ├── WelcomeScreen.jsx    # /           (public)
│   ├── PhoneNumberLogin.jsx # /login      (public, phone-based user lookup)
│   ├── FarmerRegistrationFlow.jsx # /register (auth, 3-step onboarding)
│   ├── HomeDashboard.jsx    # /dashboard  (auth)
│   ├── MyFarmsAndCropsList.jsx # /farms   (auth, dynamic from DB)
│   ├── AddNewFarmScreen.jsx # /add-farm   (auth, writes to DB)
│   ├── AIAssistantChatScreen.jsx # /assistant (auth, Dify + context)
│   ├── ProfileScreen.jsx   # /profile    (auth, logout)
│   ├── FarmActivityLogs.jsx # /activity   (auth)
│   └── FarmFinanceTracker.jsx # /finance  (auth)
└── App.jsx                  # Router + AuthGuard wiring
```

## Route Map

| Path | Screen | Auth | BottomNav | DB Tables |
|------|--------|------|-----------|-----------|
| `/` | WelcomeScreen | No | No | — |
| `/login` | PhoneNumberLogin | No | No | `farmers` (lookup) |
| `/register` | FarmerRegistrationFlow | Yes | No | `farmers`, `farms`, `ref_locations` |
| `/dashboard` | HomeDashboard | Yes | Yes | `farmers`, `farms` |
| `/farms` | MyFarmsAndCropsList | Yes | Yes | `farms` |
| `/add-farm` | AddNewFarmScreen | Yes | No | `farms` |
| `/assistant` | AIAssistantChatScreen | Yes | Yes | `farmers`, `farms` (context) |
| `/profile` | ProfileScreen | Yes | Yes | `farmers`, `farms` |
| `/activity` | FarmActivityLogs | Yes | Yes | — |

## Data Flow

```
Phone Input → localDB.auth.signInWithPhone(phone)
  ├── Found in farmers table → sign in as that farmer
  └── Not found → create new farmer row → go to /register

OnboardingComplete → localDB.from('farmers').update({ onboarding_complete: true })
                   → localDB.from('farms').insert({ ... })

Chat → difyClient.sendMessage(query, convId, userId, farmerContext)
  └── farmerContext = { name, state, district, village, farms[] }
```

## LocalDB → Supabase Migration

1. Revert `supabaseClient.js` to uncomment real Supabase client
2. Rework `useAuth.js` to use `onAuthStateChange` from Supabase
3. Rework `PhoneNumberLogin.jsx` to use real phone OTP
4. Delete `localDB.js`
5. That's it — all `.from().select().eq()` calls are already Supabase-compatible

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL (unused in mimic dev) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key (unused in mimic dev) |
| `VITE_DIFY_API_URL` | Dify Chat API base URL |
| `VITE_DIFY_CHATBOT_API_KEY` | Dify API key |

## MIMIC_DEV Markers

Every temporary pattern is marked with `// MIMIC_DEV:` in the source. Search for this string to find all rework points:

```bash
grep -rn "MIMIC_DEV" frontend/src/
```
