# BUDIGO 🧭
> **Your buddies, one journey.**  
> Real-Time Multi-User Travel Rooms, Live GPS Tracking & Fair Meeting Point Discovery.

[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-474459?style=flat-square&logo=expo)](mobile)
[![Backend Tests](https://img.shields.io/badge/Tests-62%2F62%20Passing-3D9873?style=flat-square&logo=jest)](backend/tests)
[![Google Maps](https://img.shields.io/badge/Google%20Maps-Places%20%26%20Routes-4285F4?style=flat-square&logo=googlemaps)](https://developers.google.com/maps)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20Postgres-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![License](https://img.shields.io/badge/License-MIT-D1956A?style=flat-square)](LICENSE)

---

## 🌟 Overview

**BUDIGO** is a cross-platform group travel application designed for road trips, meetups, and travel groups. Users can create shared travel rooms with a 6-character room code, stream live GPS locations, follow individual road routes to a common destination, and discover the fairest meeting spots using a real-time **Minimax Road Travel Algorithm**.

---

## ✨ Key Features

- **📍 Real-Time Destination Geocoding**: Search any landmark, city, or address using Google Places API (New) with instant autocomplete and coordinate resolution.
- **👥 Live Travel Rooms**: Create or join rooms via unique 6-character codes. Stream peer coordinates in real time over Socket.IO with adaptive GPS noise filtering.
- **🎨 Interactive Multi-User Maps**: Custom color-coded pins and live route polylines on Leaflet (Web) and Google Maps (Native).
- **🎯 Fair Meeting Point Finder (Discover)**: Connects 2 to 10 friends starting from different locations. Uses a two-tier Minimax algorithm ($\min(\max(T_i))$) to discover meeting areas and venues (cafes, restaurants, malls) where no friend has an unfair commute.
- **🚗 Multi-Modal Routing**: Switch between Driving, Walking, or Cycling with live road ETA calculations via Google Routes API.
- **🗳️ Group Voting & Consensus**: Vote on suggested venues with live WebSocket tallies and one-click host confirmation.
- **🔔 Jitter-Resistant Geofencing**: Dual-check proximity detection ensures arrival alerts trigger without false positives.

---

## 🛠️ Tech Stack

- **Mobile**: React Native, Expo Router, TypeScript, Leaflet / Google Maps.
- **Backend**: Node.js, Express, TypeScript, Socket.IO, Zod validation.
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS).
- **APIs**: Google Places API (New), Google Routes API, Geocoding API.

---

## ⚡ Quick Start

### 1. Configure Environment
Create a root `.env` file (see `.env.example`):
```ini
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
GOOGLE_PLACES_API_KEY=your_places_api_key
GOOGLE_ROUTES_API_KEY=your_routes_api_key
EXPO_PUBLIC_API_URL=http://localhost:5000
```

### 2. Run Backend
```bash
cd backend
npm install
npm run build
npm run dev
```
*Service starts on `http://localhost:5000` with WebSocket listeners active.*  
Run tests: `npm test` *(62/62 passing)*.

### 3. Run Mobile App
```bash
cd mobile
npm install
npx expo start
```
*Press `w` for Web preview (`http://localhost:8081`), `a` for Android, or `i` for iOS.*

---

## 📐 How the Fair Finder Works

Instead of calculating a straight geometric midpoint, BUDIGO evaluates actual road network durations $T(P_i \to C_j)$ using Google Routes API:

1. **Minimax Objective**: $\min_{j} \left( \max_{i} T(P_i \to C_j) \right)$  
   *Minimizes the longest commute for any group member.*
2. **Efficiency Objective**: $\min_{j} \left( \sum_{i} T(P_i \to C_j) \right)$  
   *Minimizes total travel time across all buddies.*

---

## 📄 License

Licensed under the [MIT License](LICENSE).

🌟 Overview

BUDIGO is a cross-platform group travel application designed for road trips, meetups, and travel groups. Users can create shared travel rooms with a 6-character room code, stream live GPS locations, follow individual road routes to a common destination, and discover the fairest meeting spots using a real-time Minimax Road Travel Algorithm.

✨ Key Features

📍 Real-Time Destination Geocoding: Search any landmark, city, or address using Google Places API (New) with instant autocomplete and coordinate resolution.

👥 Live Travel Rooms: Create or join rooms via unique 6-character codes. Stream peer coordinates in real time over Socket.IO with adaptive GPS noise filtering.

🎨 Interactive Multi-User Maps: Custom color-coded pins and live route polylines on Leaflet (Web) and Google Maps (Native).

🎯 Fair Meeting Point Finder (Discover): Connects 2 to 10 friends starting from different locations. Uses a two-tier Minimax algorithm (
min
⁡
(
max
⁡
(
𝑇
𝑖
)
)
min(max(T
i
	​))) to discover meeting areas and venues (cafes, restaurants, malls) where no friend has an unfair commute.

🚗 Multi-Modal Routing: Switch between Driving, Walking, or Cycling with live road ETA calculations via Google Routes API.

🗳️ Group Voting & Consensus: Vote on suggested venues with live WebSocket tallies and one-click host confirmation.

🔔 Jitter-Resistant Geofencing: Dual-check proximity detection ensures arrival alerts trigger without false positives.

🛠️ Tech Stack

Mobile: React Native, Expo Router, TypeScript, Leaflet / Google Maps.

Backend: Node.js, Express, TypeScript, Socket.IO, Zod validation.

Database & Auth: Supabase PostgreSQL with Row Level Security (RLS).

APIs: Google Places API (New), Google Routes API, Geocoding API.

⚡ Quick Start
1. Configure Environment

Create a root .env file (see .env.example):

ini
PORT=5000
NODE_ENV=development
JWT_SECRET=your_jwt_secret_key
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
GOOGLE_PLACES_API_KEY=your_places_api_key
GOOGLE_ROUTES_API_KEY=your_routes_api_key
EXPO_PUBLIC_API_URL=http://localhost:5000

2. Run Backend
bash
cd backend
npm install
npm run build
npm run dev

Service starts on http://localhost:5000 with WebSocket listeners active.
Run tests: npm test (62/62 passing).

3. Run Mobile App
bash
cd mobile
npm install
npx expo start

Press w for Web preview (http://localhost:8081), a for Android, or i for iOS.

📐 How the Fair Finder Works

Instead of calculating a straight geometric midpoint, BUDIGO evaluates actual road network durations 
𝑇
(
𝑃
𝑖
→
𝐶
𝑗
)
T(P
i
	​
→C
j
	​
) using Google Routes API:

Minimax Objective: 
min
⁡
𝑗
(
max
⁡
𝑖
𝑇
(
𝑃
𝑖
→
𝐶
𝑗
)
)
min
j
	​
(max
i
	​
T(P
i
	​
→C
j
	​
))
Minimizes the longest commute for any group member.
Efficiency Objective: 
min
⁡
𝑗
(
∑
𝑖
𝑇
(
𝑃
𝑖
→
𝐶
𝑗
)
)
min
j
	​
(∑
i
	​
T(P
i
	​
→C
j
	​
))
Minimizes total travel time across all buddies.

📄 License

Licensed under the MIT License.
