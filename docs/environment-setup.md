# BUDIGO Environment Setup Guide

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm** or **yarn**
- **Expo CLI**: `npm install -g expo-cli`
- **Git**
- Optional: Android Studio (for Android Emulator) or Xcode (macOS for iOS Simulator)
- Optional: Expo Go app installed on your physical iOS/Android device

---

## 2. Setting Up Environment Variables

Copy the provided `.env.example` in the project root:

```bash
cp .env.example .env
```

### Explanation of Variables

| Variable | Description | Where to Obtain |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Project URL | Supabase Dashboard > Project Settings > API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public Anon Client Key | Supabase Dashboard > Project Settings > API |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged Backend Key | Supabase Dashboard > Project Settings > API |
| `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` | Client-Side Maps SDK Key | Google Cloud Console > APIs & Services > Credentials |
| `GOOGLE_ROUTES_API_KEY` | Server-Side Routes API Key | Google Cloud Console (Enable Routes API & Compute Route Matrix) |
| `GOOGLE_PLACES_API_KEY` | Server-Side Places API Key | Google Cloud Console (Enable Places API New) |
| `JWT_SECRET` | Secret key for JWT signing | 32+ character random string |

> **Resilient Local Mode**: If external keys are not provided during initial test runs, Budigo automatically runs in high-fidelity local mode using simulated road circuity models and seed data, so you can test immediately without blockers!

---

## 3. Database Initialization (Supabase / Postgres)

1. Open your Supabase Dashboard or local PostgreSQL instance.
2. Navigate to **SQL Editor**.
3. Run the schema script:
   `database/migrations/001_initial_schema.sql`
4. Run the Row Level Security (RLS) policies:
   `database/policies/002_rls_policies.sql`
5. Optional: Run seed data for immediate testing:
   `database/seed/003_seed_data.sql`

---

## 4. Running the Backend Service

```bash
cd backend
npm install
npm run dev
```

The backend starts on `http://localhost:5000` with:
- Health check: `GET http://localhost:5000/health`
- WebSocket listener on port `5000`

To run the test suite:
```bash
npm test
```

---

## 5. Running the Mobile Application

```bash
cd mobile
npm install
npx expo start
```

### Running on Devices:
- **Web Browser**: Press `w` in terminal to launch in browser.
- **Android Emulator**: Press `a`.
- **iOS Simulator**: Press `i`.
- **Physical Device**: Open Expo Go and scan the terminal QR code. Ensure your phone and development computer are on the same Wi-Fi network, and set `EXPO_PUBLIC_API_URL=http://<YOUR_LAN_IP>:5000`.

