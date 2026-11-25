# BUDIGO Architecture & Engineering Specification

## 1. Executive Overview

**BUDIGO** ("Your buddies, one journey.") is a production-ready group travel, real-time GPS location tracking, and smart meeting-point optimization mobile platform.

The system solves the common challenges of group travel:
1. Fragmented navigation where group members travel from different locations with no visibility into buddies' progress.
2. Inefficient or unfair meeting point selection that results in long wait times.
3. High battery drain and GPS jitter caused by naive location tracking.

```
   ┌──────────────────────────────────────────────────────────┐
   │                    BUDIGO Mobile App                     │
   │  (React Native / Expo / Expo Router / React Native Maps) │
   └────────────────────────┬─────────────────────────────────┘
                            │
               HTTPS REST   │   WebSocket (Socket.IO)
               (JWT Auth)   │   (Bi-directional GPS Stream)
                            ▼
   ┌──────────────────────────────────────────────────────────┐
   │                 BUDIGO Backend Service                   │
   │           (Node.js / Express / Socket.IO / TS)           │
   ├────────────────────────┬─────────────────────────────────┤
   │  • Room & Auth Mgmt    │  • Minimax Meeting Point Engine │
   │  • Geofencing Engine   │  • Deterministic Color Allocator│
   │  • Adaptive Tracker    │  • Route Matrix Synthesizer     │
   └────────────┬───────────┴─────────────────┬───────────────┘
                │                             │
                ▼                             ▼
   ┌────────────────────────┐   ┌─────────────────────────────┐
   │   Supabase Postgres    │   │      Google Maps APIs       │
   │  • RLS Access Control  │   │  • Routes API (Road Network)│
   │  • B-Tree Geospatial   │   │  • Compute Route Matrix API │
   │  • Realtime Replicas   │   │  • Places API (New)         │
   └────────────────────────┘   └─────────────────────────────┘
```

---

## 2. Brand Identity & Design System

Budigo utilizes a bespoke visual design language:

| Role | Color | Hex Code | Description |
|---|---|---|---|
| Main Background | Soft Ivory | `#F8F5F7` | Calming, warm neutral canvas |
| Primary Accent | Warm Terracotta | `#D1956A` | Buttons, highlights, active routes |
| Typography / Nav | Deep Charcoal Purple | `#474459` | Headings, readable high-contrast labels |
| Supporting Border | Light Grey / Border | `#E5DFE4` | Crisp, modern card outlines |
| Success / Arrival | Emerald Green | `#3D9873` | Arrival status, verified indicators |

### Deterministic 10-Color Palette
Every room member is deterministically allocated a unique marker color that persists across map markers, road route polylines, and progress dashboards:
1. `#D1956A` (Terracotta - Creator)
2. `#4C78C9` (Blue)
3. `#419A77` (Green)
4. `#8B6BC1` (Purple)
5. `#E47776` (Coral)
6. `#329D9B` (Teal)
7. `#C39A43` (Mustard)
8. `#D36F9B` (Pink)
9. `#626DBA` (Indigo)
10. `#E58A47` (Orange)

---

## 3. Real-Time GPS Tracking & Battery-Adaptive Synchronization

Naive mobile GPS apps broadcast coordinates every second, draining battery and flooding network sockets. Budigo implements a dual-tier adaptive strategy:

### A. Client-Side Adaptive Acquisition
- Uses `expo-location` with balanced accuracy (`Location.Accuracy.Balanced`).
- Distance filter: **12 meters** minimum displacement.
- Time interval: **4.5 seconds** minimum report delay.
- Velocity awareness: When stationary, updates back off gracefully.

### B. Geofencing & Jitter-Resistant Arrival Detection
GPS signals jitter near dense urban buildings. Budigo protects against false arrivals using consecutive threshold checks:
- Threshold distance to destination: $\le 100\text{ meters}$.
- GPS Accuracy requirement: $\le 30\text{ meters}$ (ignores wild GPS jumps).
- Confirmation rule: Requires **2 consecutive confirmed checks** before marking status as `Arrived` and triggering broadcast notification.
- Prevents duplicate alerts.

---

## 4. Smart Meeting-Point Optimization Engine

Rather than computing a naive straight-line centroid (which often falls in an inaccessible body of water, private property, or across impassable terrain), Budigo executes a two-phase optimization:

### Phase 1: Candidate Generation
1. Compute the spherical centroid $C(\text{lat}, \text{lon})$ of all participant coordinates:
   $$\bar{X} = \frac{1}{N}\sum \cos(\text{lat}_i)\cos(\text{lon}_i), \quad \bar{Y} = \frac{1}{N}\sum \cos(\text{lat}_i)\sin(\text{lon}_i), \quad \bar{Z} = \frac{1}{N}\sum \sin(\text{lat}_i)$$
2. Discover accessible candidate venues (cafes, restaurants, transit hubs, malls) within a $5000\text{m}$ radius using the **Google Places API (New)**.

### Phase 2: Minimax Road Network Optimization
1. Query **Google Routes Compute Route Matrix API** to compute the actual driving time $T_{ij}$ and road distance $D_{ij}$ from participant $i$ to candidate $j$.
2. **Minimax Objective (Primary)**:
   $$\text{minimize } \max_{i \in \{1 \dots N\}} T_{ij}$$
   Minimizes the maximum wait time of any buddy, ensuring everyone arrives close together.
3. **Total Travel Time (Secondary)**:
   $$\text{minimize } \sum_{i=1}^N T_{ij}$$
4. **Composite Ranking Score (0 to 100)**:
   $$\text{Score}_j = 0.50 \cdot S_{\text{max}} + 0.25 \cdot S_{\text{avg}} + 0.15 \cdot S_{\text{variance}} + 0.10 \cdot S_{\text{rating}}$$
   where $S_{\text{variance}}$ rewards low standard deviation in arrival times (high fairness).

---

## 5. Security & Location Privacy

- **Explicit Consent**: Location sharing is opt-in and can be paused at any time by the user.
- **Room-Level Boundary**: GPS coordinates are transmitted exclusively over room-scoped WebSocket channels (`room:${roomId}`).
- **Row-Level Security (RLS)**: PostgreSQL tables enforce that users can only select location rows for rooms where they are active members with `location_sharing_enabled = true`.
- **Privileged Credentials**: Google Routes and Places API keys with write/billing quotas reside exclusively on the backend server.

