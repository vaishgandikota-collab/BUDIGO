# BUDIGO Environment Setup & Developer Guide

This guide describes how to configure, run, and develop the BUDIGO ecosystem locally across all modules: backend, database, and the 13-screen mobile application.

---

## 1. System Prerequisites

Before starting, ensure your local development environment has:

| Requirement | Minimum Version | Recommended | Notes |
|---|---|---|---|
| **Node.js** | v18.0.0 | v20.x or v22.x LTS | Runtime for backend and Expo CLI |
| **npm** | v9.0.0 | v10.x | Package manager |
| **Git** | v2.30+ | Latest | Version control |
| **Expo CLI** | Latest | `npm install -g expo-cli` | Development server |
| **EAS CLI** | Latest | `npm install -g eas-cli` | For production cloud builds |

---

## 2. Environment Configuration

1. Clone the repository and navigate to the project directory:
   ```bash
   cd budigo
   ```

2. Copy the `.env.example` file to create your local `.env`:
   ```bash
   cp .env.example .env
   ```

3. Ensure the environment variables match your local environment:
   ```env
   # Server settings
   PORT=5000
   NODE_ENV=development
   API_BASE_URL=http://localhost:5000
   EXPO_PUBLIC_API_URL=http://localhost:5000
   EXPO_PUBLIC_SOCKET_URL=http://localhost:5000

   # Database (Local / Supabase)
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

   # Google Maps Platform
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...
   GOOGLE_ROUTES_API_KEY=AIzaSy...
   GOOGLE_PLACES_API_KEY=AIzaSy...

   # Authentication
   JWT_SECRET=budigo-development-secret-key-32-characters-minimum
   JWT_EXPIRES_IN=7d
   ```

---

## 3. Database Setup (Supabase / PostgreSQL)

1. Access your Supabase project (or local PostgreSQL instance).
2. Open the **SQL Editor**.
3. Run the migrations in the following order:
   - `database/migrations/001_initial_schema.sql` (Creates core tables and performance indexes)
   - `database/policies/002_rls_policies.sql` (Applies Row Level Security policies)
   - `database/seed/003_seed_data.sql` (Optional: Populates demo Goa trip data for local exploration)

---

## 4. Running the Backend Service

1. Navigate to the `backend` folder and install dependencies:
   ```bash
   cd backend
   npm install
   ```

2. Compile TypeScript and run the development server with live reload:
   ```bash
   npm run dev
   ```
   The backend service starts at `http://localhost:5000`.

3. Verify server health:
   ```bash
   curl http://localhost:5000/health
   ```

4. Execute the automated test suite:
   ```bash
   npm test
   ```
   All 9 test suites (62 tests) will execute and report passing status.

---

## 5. Running the Mobile Application

1. In a separate terminal, navigate to the `mobile` folder:
   ```bash
   cd mobile
   npm install
   ```

2. Start the Expo development server:
   ```bash
   npx expo start
   ```

3. Choose your target platform:
   - Press **`w`** to open in Web browser (Chrome / Edge / Firefox).
   - Press **`a`** to open in Android Emulator (requires Android Studio).
   - Press **`i`** to open in iOS Simulator (requires macOS + Xcode).
   - Scan the QR code using the **Expo Go** app on your physical Android or iPhone device.

> **Physical Device Tip:** When running on a physical phone via Expo Go, ensure both your computer and phone are connected to the same local Wi-Fi network. Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_SOCKET_URL` in your `.env` to your machine's LAN IP (e.g. `http://192.168.1.50:5000`).

