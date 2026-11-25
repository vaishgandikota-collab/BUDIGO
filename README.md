# BUDIGO 🧭
> **Your buddies, one journey.**  
> Real-Time Multi-User Travel Rooms, Live GPS Tracking, Google Maps (Places & Routes) Integration, and Fair Meeting Point Discovery.

[![Backend Tests](https://img.shields.io/badge/backend%20tests-62%2F62%20passing-3D9873?style=for-the-badge&logo=jest)](backend/tests)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-474459?style=for-the-badge&logo=expo)](mobile)
[![Google Maps](https://img.shields.io/badge/Google%20Maps-Places%20(New)%20%26%20Routes-4285F4?style=for-the-badge&logo=googlemaps)](https://developers.google.com/maps)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20Postgres-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-D1956A?style=for-the-badge)](LICENSE)

---

## 🌟 Overview

**BUDIGO** is a full-stack, cross-platform group travel application engineered for friends, road-trippers, and travel groups. Users can create shared travel rooms, invite friends via 6-character room codes, share live GPS locations in real time, follow individual road routes to a common destination, discover optimal meeting spots using a **Minimax Fair Convergence Algorithm**, and coordinate their entire journey seamlessly.

---

## ✨ Core Features

### 1. 📍 Automatic Destination Search & Geocoding
- **Google Places API (New) Autocomplete**: Instant, debounced destination search across cities, landmarks, cafes, beaches, restaurants, and custom addresses.
- **Detailed Place Coordinate Resolution**: Resolves exact latitude, longitude, formatted address, and Place ID for reliable navigation.
- **Dynamic Destination Updating**: Room hosts can change destination on the fly; changes broadcast instantly to all members via WebSockets.

### 2. 👥 Travel Rooms & Live Telemetry
- **Instant Room Creation**: Enter a trip name and destination to generate a unique 6-character code (e.g. `BUD482`).
- **Join by Room Code**: Friends join in seconds; each member is automatically assigned a unique color from a deterministic 10-color palette.
- **Real-Time GPS Tracking**: Streams coordinates over bi-directional **Socket.IO** channels with adaptive noise filtering (12m threshold, 4.5s sync interval).
- **Interactive Multi-User Map**: Leaflet on Web and Google Maps on native iOS/Android, rendering custom member markers, destination pins, and individual road routes.
- **Privacy & Power Controls**: Members can pause/resume location sharing at any time; battery-friendly backoff when stationary.

### 3. 🎯 Discover Page: Multi-User Fair Meeting Point Finder
- **For 2 to 10 Friends Starting From Different Places**:
  - **Option A (Live GPS)**: Detects device position via `expo-location` and reverse-geocodes with Google Geocoding API.
  - **Option B (Manual Search)**: Google Places Autocomplete search field to search any starting address.
  - **1-Click Hyderabad/Regional Presets**: Instant testing with pre-configured multi-point convergence scenarios.
- **Two-Tier Minimax Road Optimization**:
  - **Tier 1 (Destination Areas)**: Computes geographic centroid, queries regional commercial hubs, and calculates actual road travel time from *every* participant via **Google Routes API**. Ranks top 3–5 areas by $\min(\max(T_i))$ (Minimax fairness) and $\min(\sum T_i)$ (group efficiency).
  - **Tier 2 (Specific Venues)**: Discovers real cafes, restaurants, malls, and attractions in the selected area. Renders individual color-coded road routes (polylines) from every friend to the venue.
  - **Travel Mode Selector**: Toggle Driving (`DRIVE` 🚗), Walking (`WALK` 🚶), or Cycling (`BICYCLE` 🚲) to recalculate road travel times and rerank spots.
  - **Participant Breakdown & Sharing**: Detailed breakdown showing friend name, starting location, road distance (km), and ETA, with direct links to Google Maps and native share buttons.

### 4. ☕ Destination-Based Smart Meeting Point Finder
- Discovers real-world venues near the room's destination (cafes, restaurants, parking, transit, tourist attractions).
- Calculates road distance and driving times from the destination using Google Places API (New) and Routes API.

### 5. 🗳️ Group Voting & Consensus
- Members cast votes for recommended meeting spots.
- Live tally updates with vote counts and percentages via WebSockets.
- Host confirms winning meeting point, syncing the confirmed meeting spot onto every member's active map.

### 6. 🔔 Jitter-Resistant Arrival Detection & Notifications
- Evaluates proximity within 100 meters with $\le 30\text{m}$ accuracy.
- Requires **2 consecutive confirmed checks** before marking `Arrived` to eliminate GPS jitter false positives.
- Real-time in-app alerts and push notifications for arrivals, room activity, and meeting updates.

---

## 🎨 Design System & Color Palette

BUDIGO follows a clean, modern aesthetic:

| Color Token | Hex Code | Purpose |
|---|---|---|
| **Soft Ivory** | `#F8F5F7` | Main canvas background |
| **Warm Terracotta** | `#D1956A` | Primary branding, buttons, active highlights |
| **Deep Charcoal Purple** | `#474459` | Typography, readable high-contrast elements |
| **Success Emerald** | `#3D9873` | Arrival status and verified indicators |
| **Warning Amber** | `#D97706` | Alerts and rating badges |

### Deterministic 10-Color Member Palette
Every room member is automatically allocated a distinct marker and route color:
`#D1956A`, `#4C78C9`, `#419A77`, `#8B6BC1`, `#E47776`, `#329D9B`, `#C39A43`, `#D36F9B`, `#626DBA`, `#E58A47`.

---

## 📐 Mathematical Formulation

### 1. Geographic Centroid & Median
Given $N$ participants with coordinates $(\text{lat}_i, \text{lon}_i)$:
$$\text{Centroid} = \left(\frac{1}{N}\sum_{i=1}^{N} \text{lat}_i, \; \frac{1}{N}\sum_{i=1}^{N} \text{lon}_i\right)$$

### 2. Minimax Road Travel Time Optimization
For each candidate meeting point $C_j$, the road travel duration $T(P_i \to C_j)$ is computed via the **Google Routes API**:
- **Primary Objective (Minimax Fairness)**:
  $$\min_{j} \left( \max_{i} T(P_i \to C_j) \right)$$
  *Guarantees no single participant suffers an excessively long travel time.*
- **Secondary Objective (Group Efficiency)**:
  $$\min_{j} \left( \sum_{i=1}^{N} T(P_i \to C_j) \right)$$

---

## 🏗️ Architecture & Tech Stack

```
budigo/
├── backend/                  # Node.js + Express + TypeScript + Socket.IO
│   ├── src/
│   │   ├── algorithms/       # Haversine, Centroid & Minimax Optimizer
│   │   ├── config/           # Environment & Supabase Client
│   │   ├── controllers/      # Auth, Rooms, Locations, Navigation, Meeting, Votes
│   │   ├── middleware/       # JWT Auth, Rate Limiters, Error Handling
│   │   ├── routes/           # REST endpoints
│   │   ├── services/         # Google Maps API (Places/Routes), Notifications, Geofence
│   │   ├── sockets/          # Real-time WebSocket handlers
│   │   ├── types/            # TypeScript schemas & interfaces
│   │   └── server.ts         # Server entrypoint
│   └── tests/                # 9 Jest automated test suites (62 tests)
│
├── mobile/                   # React Native + Expo Router + TypeScript
│   ├── app/                  # File-based routing (Auth, Tabs, Room, Meeting, Discover)
│   ├── components/           # UI components (Maps, Meeting, Common, Room)
│   ├── hooks/                # useAuth, useRoom, useRoomRoutes, useLocationTracking
│   ├── services/             # API client, Socket client, Location service
│   ├── constants/            # Colors, Theme tokens, API configuration
│   └── types/                # Frontend TypeScript models
│
├── database/                 # Supabase PostgreSQL migrations & RLS policies
│   ├── migrations/           # 001_initial_schema.sql (8 tables, 13 performance indexes)
│   └── policies/             # Row Level Security (RLS) rules
│
└── docs/                     # Full technical & architectural documentation
```

---

## ⚡ Quick Start Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **pnpm**
- **Expo Go** app on your physical mobile device (optional, for iOS/Android testing)
- **Google Cloud API Keys** with:
  - Places API (New)
  - Routes API
  - Geocoding API
  - Maps SDK for Android / iOS

---

### Step 1: Clone Repository & Configure Environment

```bash
git clone https://github.com/your-username/budigo.git
cd budigo
```

Create a root `.env` file (refer to `.env.example`):

```ini
PORT=5000
NODE_ENV=development
JWT_SECRET=your_super_secret_jwt_key_budigo_2026
CORS_ORIGIN=*

# Supabase PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Google Maps Platform APIs
GOOGLE_PLACES_API_KEY=AIzaSy...your_google_places_api_key
GOOGLE_ROUTES_API_KEY=AIzaSy...your_google_routes_api_key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...your_client_maps_key
EXPO_PUBLIC_API_URL=http://localhost:5000
```

---

### Step 2: Install & Run Backend

```bash
cd backend
npm install
npm run build
npm run dev
```

*The backend service will start on `http://localhost:5000` with WebSocket listeners active.*

To execute automated tests:
```bash
npm test
```
*(62/62 unit & integration tests passing across 9 suites)*

---

### Step 3: Install & Run Mobile App

In a new terminal window:

```bash
cd mobile
npm install
npx expo start
```

* Keyboard shortcuts in the Expo CLI:
  - Press `w` to open in your **Web Browser** (`http://localhost:8081`).
  - Press `a` to open in an **Android Emulator**.
  - Press `i` to open in an **iOS Simulator**.
  - Scan the QR code with **Expo Go** on your mobile device.

---

## 📱 Application Screens

| Screen | Route | Description |
|---|---|---|
| **Home** | `/(tabs)` | Quick actions (Create / Join room), active room cards, privacy status. |
| **Discover** | `/(tabs)/discover` | Multi-user fair meeting point finder for 2–10 friends with live Leaflet map and road routes. |
| **Create Room** | `/room/create` | Set trip name and search destination with Google Places Autocomplete. |
| **Join Room** | `/room/join` | Enter 6-character room code and display name. |
| **Travel Room** | `/room/[id]` | Full interactive map, member pins, live road polylines, buddy tray. |
| **Smart Meeting Point** | `/meeting-points/finder` | Destination-based smart venue search near the room's destination. |
| **Group Voting** | `/voting/[id]` | Real-time candidate voting with live percentage tallies. |
| **Trip Progress** | `/room/progress` | Group ETA summary and individual telemetry (speed, distance, status). |
| **Notifications** | `/(tabs)/notifications` | Real-time arrival alerts, destination changes, and meeting confirmations. |
| **Profile** | `/(tabs)/profile` | Location privacy toggles, alert preferences, and account details. |

---

## 🔒 Security & Performance Features

- **Rate Limiting**: Tiered limiters on authentication, place search, and route matrix computations.
- **Fail-Fast Production Guards**: Validates presence of critical API keys before processing requests.
- **Strict Zod Input Validation**: Sanitizes coordinates, place IDs, and search queries.
- **Resilient Fallback Mode**: Gracefully handles network latency or quota limits while maintaining UI responsiveness.
- **Environment-Aware CORS & Helmet**: Hardened HTTP headers for secure cross-origin communication.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
