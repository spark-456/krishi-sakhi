# Krishi Sakhi - Project Architecture & Demo Guide

This document explains the folder structure, how the application works, and the differences between the "Real App" (Production) and the "Demo App" (Current Mimic Dev phase) setups. This guide is designed to help teammates and professors understand the underlying mechanics, data flow, and architecture of the Krishi Sakhi progressive web application (PWA).

---

## 🛠️ Technology Stack
* **Frontend Framework**: React 18
* **Build Tool**: Vite (configured for PWA support)
* **Styling**: Tailwind CSS (Utility-first CSS)
* **Routing**: React Router DOM (Client-side routing)
* **Icons**: Lucide React
* **AI Integration**: Dify API (for the "Ask Sakhi" chatbot)
* **Database (Production)**: Supabase (PostgreSQL, Auth, Storage)
* **Database (Demo/Local)**: Browser `localStorage` (custom mock implementation)

---

## 📂 Detailed Folder Structure

The application is built using a modern component-driven React architecture. All primary code resides in the `frontend/src/` directory.

### `frontend/src/`
The root of the frontend application source code.
* **`App.jsx`**: The main application root component. It handles the core routing logic (using `react-router-dom`) and wraps the entire application in global providers (like `AuthProvider`). It also implements the `ProtectedLayout` which manages the persistent `BottomNavigation` visibility and ensures proper spacing (`pb-20` padding) so content isn't obscured by the bottom bar.
* **`main.jsx`**: The React entry point that mounts the `App` component to the HTML DOM.
* **`index.css`**: Global stylesheet containing Tailwind CSS base directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`) and custom global CSS variables if any.

### `frontend/src/components/`
Contains modular, reusable UI building blocks utilized across different screens.
* **`AddActivityModal.jsx`**: A highly interactive bottom-sheet modal. It allows users to log manual farm activities. It provides 10 predefined agricultural activity types (e.g., Irrigation, Fertilizing, Pest Control) with corresponding icons and color coding. It links the activity to a specific farm and crop.
* **`AddCropModal.jsx`**: A bottom-sheet modal to add new crops to a specific farm plot. It includes a searchable dropdown for crop selection, and inputs for season (Kharif, Rabi, Zaid), current growth stage, and planting date. Crucially, successful submission automatically triggers a "Planting" generation in the activity log.
* **`BottomNavigation.jsx`**: The fixed UI navigation bar at the bottom of the screen. It uses fixed positioning and z-indexing to remain visible, allowing fast client-side switching between Home, Farms, Ask Sakhi, Logs, and Profile routes.
* **`Card.jsx`, `Button.jsx`, `Input.jsx`**: Basic atomic UI components used to maintain design consistency across the app.

### `frontend/src/screens/`
Contains the main page views of the application (each represents a distinct URL route).
* **`OnboardingScreen.jsx` & `LoginScreen.jsx`**: Handles initial user registration. Features include a multi-step form, a mock OTP authentication flow, and integration with the browser's Geolocation API to fetch coordinates, which are then reverse-geocoded (using Nominatim OpenStreetMap API) to auto-fill the user's state, district, and town.
* **`MyFarmsAndCropsList.jsx`**: The primary dashboard for farm management (the "Farms" tab). It displays existing farm plots as cards, maps actively growing crops to those farms with visual growth stage badges, and provides the entry point for the `AddCropModal`.
* **`FarmActivityLogs.jsx`**: The "Logs" tab. A database-backed timeline view of all historical activities performed on the farms. Features include filtering by activity type, searching by text, and a Floating Action Button (FAB) to trigger the `AddActivityModal`.
* **`AIAssistantChatScreen.jsx`**: The "Ask Sakhi" tab. This is the UI for the AI chatbot. It manages local chat history state, handles user text input, and displays alternating user/AI message bubbles. It also features a "context badge" showing what local data the AI is currently aware of.
* **`ProfileScreen.jsx`**: The "Profile" tab. Displays aggregate user statistics (e.g., Total Farms, Total Acres, Total Crops), allows inline editing of the user's name and phone number, shows a preview of recent activity logs, and provides a "Clear Local Data" dev utility.

### `frontend/src/lib/`
Contains core utilities, API clients, and database interactions. **This folder is the architectural keystone for switching between the Demo and Real app environments.**
* **`localDB.js`**: (Demo Side) A highly robust, custom-built local mock of the Supabase client using the browser's synchronous `localStorage` API. It implements the exact same asynchronous data fetching methods (`select()`, `insert()`, `update()`, `eq()`) as Supabase.
* **`supabaseClient.js`**: (Real App) The actual, standard Supabase client configuration for production, initializing connection to the remote PostgreSQL database.
* **`difyClient.js`**: The service integration file for the Dify AI backend. It formats outgoing REST API requests to Dify, managing endpoints, API keys, and injected prompt context.

---

## ⚙️ How the Core Systems Work

The Krishi Sakhi app uses advanced interactive patterns:

### 1. Data Flow & State Management
The app uses React's Context API (specifically an `AuthProvider` wrapping the app) to maintain the current user session. Individual screens use `useEffect` hooks to fetch data on component mount. For example, `MyFarmsAndCropsList.jsx` fetches `farms` and `farm_crops` on load, mapping them together in memory for display.

### 2. Event-Driven Auto-Logging
We implemented a strict chain of events for data integrity. When a user completes the `AddCropModal` form and clicks save:
1. The new crop is inserted into the `farm_crops` table.
2. Upon successful insertion, a secondary background call automatically generates a "Planting" record in the `activity_logs` table, linked to the newly created crop ID and the parent farm ID.

### 3. Context-Aware AI Injection
When a user opens the "Ask Sakhi" screen (`AIAssistantChatScreen.jsx`):
1. The component asynchronously fetches the user's active `farm_crops` and their 5 most recent `activity_logs`.
2. When the user sends a message, this data is formatted into JSON strings.
3. The `difyClient.js` sends the user's text prompt to Dify **along with** the `farmer_crops` and `farmer_recent_activities` variables.
4. The Dify backend receives this context, allowing the LLM to ground its advice in the farmer's actual reality (e.g., knowing they just planted Paddy 3 days ago).

---

## 🔄 Real App vs. Demo App Operations

A key engineering requirement was the ability to present the application seamlessly without an internet connection or a live database, while preserving a quick path to production.

### 1. The Demo Side ("Mimic Dev" Phase - Current State)
* **Where data is stored:** Browser memory (`localStorage`).
* **Handler logic:** `frontend/src/lib/localDB.js`
* **Data Structure:** The mock database maintains strict JSON arrays representing relational tables:
  * `krishi_users`: ID, phone, name, state, district.
  * `krishi_farms`: ID, user_id, name, location, acres.
  * `krishi_farm_crops`: ID, farm_id, crop_name, growth_stage.
  * `krishi_activity_logs`: ID, farm_id, action_type, description.
* **How it works:** `localDB.js` is programmed to perfectly *mimic* the API signature of Supabase. For example, `localDB.from('farms').select('*')` returns a Promise that resolves to the parsed local storage data, exactly as Supabase would.
* **Authentication:** Hardcoded bypass. Any phone number (e.g., `9876543210`) and a static OTP (`123456`) immediately generates a local session token and logs the user in.
* **Why we use this:** For rapid UI/UX prototyping, academic presentations, hackathon pitches, and offline demonstrations. It guarantees zero latency and zero risk of live database corruption during a demo.

### 2. The Real App (Production Ready)
* **Where data is stored:** Remote PostgreSQL Database (Supabase Cloud).
* **Handler logic:** `frontend/src/lib/supabaseClient.js`
* **How it works:** When we are ready to connect the real backend, we simply perform a global find-and-replace in our components, changing `import { localDB } from '../lib/localDB'` to `import { supabase } from '../lib/supabaseClient'`. The component logic, `useEffect` dependencies, and data mapping functions require **zero changes** because `localDB.js` mapped 1:1 with the Supabase schema and method names.
* **Authentication:** Real SMS OTP verification via Supabase Auth services.
* **Why we use this:** Persistent cloud data sync, secure multi-device login, real user management, and the ability to perform complex relational JOIN queries natively in PostgreSQL.

---

## 🤖 AI Assistant (Ask Sakhi)
The AI is powered by the **Dify API** and is currently live and functional in both Demo and Real app configurations.
* **Storage**: Chat history is cached locally per user under `chat_history_[user_id]`.
* **Architecture**: The `difyClient.js` handles requests to the Dify REST endpoints. It securely manages the `VITE_DIFY_CHATBOT_API_KEY`.
* **The "Magic"**: To ensure the AI acts as an expert agronomist rather than a generic chatbot, system prompts inside the Dify platform are designed to accept specific variables. Our frontend dynamically populates these variables (`farmer_crops`, `farmer_recent_activities`) on every single query. This means Ask Sakhi doesn't need to ask "What crops are you growing?" because our frontend automatically injects that knowledge into the prompt payload invisibly before the AI generates a response.
