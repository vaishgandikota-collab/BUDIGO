# BUDIGO Production Deployment Guide

## 1. Backend Deployment (Render / Railway)

### A. Deploying to Render
1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect your Git repository.
3. Configure the build and start settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Set Environment Variables:
   - `NODE_ENV=production`
   - `PORT=10000`
   - `SUPABASE_URL=...`
   - `SUPABASE_SERVICE_ROLE_KEY=...`
   - `GOOGLE_ROUTES_API_KEY=...`
   - `GOOGLE_PLACES_API_KEY=...`
   - `JWT_SECRET=...`
5. Enable health check path: `/health`.

### B. Deploying to Railway
```bash
railway init
railway up
```
In Railway dashboard, add environment variables and set root directory to `backend`.

---

## 2. Database Deployment (Supabase Hosted PostgreSQL)

1. Create a project at [database.new](https://database.new).
2. Execute the migrations in order:
   - `database/migrations/001_initial_schema.sql`
   - `database/policies/002_rls_policies.sql`
3. Verify that RLS is active on all tables.
4. Copy `API URL` and `service_role key` into your backend environment.

---

## 3. Mobile App Deployment (Expo EAS Build)

### A. Install EAS CLI and Authenticate
```bash
npm install -g eas-cli
eas login
```

### B. Configure EAS Project
```bash
cd mobile
eas build:configure
```

Create an `eas.json` file:
```json
{
  "cli": {
    "version": ">= 10.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {
        "simulator": false
      }
    }
  },
  "submit": {
    "production": {}
  }
}
```

### C. Build Android App Bundle (AAB) for Google Play Store
```bash
eas build --platform android --profile production
```

### D. Build iOS Archive (IPA) for Apple App Store
```bash
eas build --platform ios --profile production
```

### E. Store Submission with EAS Submit
```bash
# Submit to Google Play
eas submit --platform android

# Submit to App Store Connect / TestFlight
eas submit --platform ios
```

---

## 4. Google Cloud Platform Key Restrictions

To safeguard billing and ensure zero unauthorized usage:

1. **Client Maps SDK Key** (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`):
   - Restrict to: **Maps SDK for Android** & **Maps SDK for iOS**.
   - Application restriction:
     - Android: Package name `com.budigo.app` + SHA-1 certificate fingerprint.
     - iOS: Bundle identifier `com.budigo.app`.

2. **Server-Side API Key** (`GOOGLE_ROUTES_API_KEY` & `GOOGLE_PLACES_API_KEY`):
   - Restrict to: **Routes API**, **Compute Route Matrix API**, and **Places API (New)**.
   - Application restriction: IP address of your deployed backend (e.g. Render/Railway outbound IPs).
   - **Never include these keys in mobile app source code or bundles.**

