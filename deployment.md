# BUDIGO Production Deployment Guide

This document provides complete, step-by-step instructions for deploying the BUDIGO real-time group travel platform to production across all tiers: Backend API & WebSockets, Database (Supabase PostgreSQL), and Mobile Client (Expo EAS Build for Android & iOS).

---

## 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          Mobile Application            │
                      │     (Expo / React Native 13 Screens)   │
                      └──────────────┬───────────────────┬─────┘
                                     │                   │
                  HTTPS REST API     │                   │  WSS Real-time
                                     ▼                   ▼
                      ┌────────────────────────────────────────┐
                      │            Budigo Backend              │
                      │       (Node.js / Express / Socket.IO)  │
                      └──────────────┬───────────────────┬─────┘
                                     │                   │
                     SQL Connection  │                   │  Server-Side REST
                                     ▼                   ▼
                      ┌──────────────────────┐   ┌──────────────────────┐
                      │       Supabase       │   │  Google Cloud APIs   │
                      │  Hosted PostgreSQL   │   │  - Routes Matrix API │
                      │  + Row Level Security│   │  - Places API (New)  │
                      └──────────────────────┘   └──────────────────────┘
```

---

## 2. Database Deployment (Supabase Hosted PostgreSQL)

### Step 1: Provision Supabase Project
1. Log in to [Supabase Console](https://supabase.com).
2. Click **New Project**, select an organization, name the project `budigo-production`, set a strong database password, and choose your preferred AWS region.
3. Once provisioned, note down your:
   - **Project URL** (`https://<project-ref>.supabase.co`)
   - **Public Anon Key** (`anon` key)
   - **Service Role Secret Key** (`service_role` secret key - keep secure!)

### Step 2: Apply Database Schema & Migrations
In the Supabase SQL Editor, run the following migration scripts in order:

1. `database/migrations/001_initial_schema.sql`
   - Creates tables: `profiles`, `rooms`, `room_members`, `locations`, `meeting_points`, `votes`, `notifications`, `navigation_routes`
   - Creates performance indexes for coordinates, foreign keys, and query lookups:
     - `idx_rooms_code`
     - `idx_room_members_room_id`
     - `idx_room_members_user_id`
     - `idx_locations_user_room`
     - `idx_locations_created_at`
     - `idx_meeting_points_room_id`
     - `idx_votes_room_id`
     - `idx_notifications_user_id`

2. `database/policies/002_rls_policies.sql`
   - Enables Row Level Security (RLS) on all 8 tables.
   - Applies strict isolation policies:
     - `profiles`: Users can only read/update their own profile.
     - `rooms`: Readable by authenticated users; update/delete restricted to room creator.
     - `room_members`: Read/join permissions scoped to room participants.
     - `locations`: Readable only by members of the same active room.
     - `votes`: Scoped to active room members; 1 vote per member.
     - `notifications`: Isolated strictly to `auth.uid() = user_id`.

### Step 3: Backups & Data Retention
- Supabase automatically performs Daily Physical Backups (with Point-in-Time Recovery on Pro tier).
- Configure automated retention for the `locations` telemetry table:
  ```sql
  -- Run weekly or configure pg_cron to prune location telemetry older than 30 days
  DELETE FROM locations WHERE created_at < NOW() - INTERVAL '30 days';
  ```

---

## 3. Backend Deployment (Node.js / Express / Socket.IO)

The backend can be deployed on any containerized or PaaS infrastructure (Render, Railway, Fly.io, AWS ECS, GCP Cloud Run). Below are instructions for Render and Docker/VPS.

### Option A: Render Web Service

1. Create a new **Web Service** on [Render.com](https://render.com).
2. Connect your Git repository containing the Budigo project.
3. Configure settings:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/health`
4. Add Environment Variables in the Render Dashboard:
   ```env
   NODE_ENV=production
   PORT=10000
   SUPABASE_URL=https://<project-ref>.supabase.co
   SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   JWT_SECRET=super-secure-production-jwt-secret-min-32-chars-long
   JWT_EXPIRES_IN=7d
   GOOGLE_ROUTES_API_KEY=AIzaSy...
   GOOGLE_PLACES_API_KEY=AIzaSy...
   CORS_ORIGIN=https://budigo.app,https://api.budigo.app
   ```
5. Deploy. Verify that Render reports the service healthy via `GET /health` and `GET /ready`.

### Option B: Docker / PM2 on Linux VPS / AWS EC2

1. Build backend TypeScript:
   ```bash
   cd backend
   npm install --production=false
   npm run build
   ```
2. Run with PM2:
   ```bash
   npm install -g pm2
   pm2 start dist/server.js --name "budigo-api" -i max
   pm2 save
   pm2 startup
   ```
3. Configure NGINX reverse proxy with WebSocket upgrade support:
   ```nginx
   server {
       server_name api.budigo.app;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
4. Obtain an SSL certificate using Certbot:
   ```bash
   sudo certbot --nginx -d api.budigo.app
   ```

---

## 4. External Services Configuration & Key Restrictions

### Google Cloud Platform Setup

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Create project `budigo-production`.
3. Enable the following APIs:
   - **Maps SDK for Android**
   - **Maps SDK for iOS**
   - **Routes API** & **Compute Route Matrix API**
   - **Places API (New)**

4. **Client Maps API Key** (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`):
   - Scope: Client-side mobile map tile and marker rendering.
   - API Restrictions: **Maps SDK for Android**, **Maps SDK for iOS**.
   - Application Restrictions:
     - Android: Package name `com.budigo.app` + Release Keystore SHA-1 Fingerprint.
     - iOS: Bundle Identifier `com.budigo.app`.

5. **Server Routes & Places Keys** (`GOOGLE_ROUTES_API_KEY`, `GOOGLE_PLACES_API_KEY`):
   - Scope: Server-side route matrices, road navigation polylines, and candidate venue discovery.
   - API Restrictions: **Routes API**, **Places API (New)**.
   - Application Restrictions: **IP addresses** of the production backend hosts.
   - **NEVER** expose these keys to the client mobile application or bundle.

---

## 5. Mobile Application Deployment (Expo EAS Build)

### Step 1: Install & Authenticate EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Step 2: Configure Project ID
In the `mobile` directory:
```bash
cd mobile
eas init
```

### Step 3: Build Android App (APK for testing / AAB for Play Store)

**Preview APK (for manual internal device testing):**
```bash
eas build --platform android --profile preview
```

**Production Android App Bundle (for Google Play Console):**
```bash
eas build --platform android --profile production
```

### Step 4: Build iOS Archive (IPA for App Store Connect / TestFlight)
```bash
eas build --platform ios --profile production
```

### Step 5: Submit to App Stores
```bash
# Submit Android to Google Play Internal Testing / Production
eas submit --platform android

# Submit iOS to App Store Connect / TestFlight
eas submit --platform ios
```

---

## 6. Production Health Check Verification

After deployment, verify the live services using standard curl requests:

```bash
# 1. API Health Check
curl -i https://api.budigo.app/health
# Expected: HTTP 200 {"status":"healthy","application":"BUDIGO Backend","version":"1.0.0",...}

# 2. System Readiness Check
curl -i https://api.budigo.app/ready
# Expected: HTTP 200 {"status":"ready","database":"connected","realtime":"active",...}

# 3. Test Room Creation Flow
curl -i -X POST https://api.budigo.app/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Prod Test","email":"prod-test@budigo.app","password":"Password123!"}'
```

