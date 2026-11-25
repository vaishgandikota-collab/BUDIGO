# BUDIGO REST API & Real-Time Socket Specification

Base URL: `http://localhost:5000/api` (Development) or your deployed production URL.

All authenticated requests require the header:
```http
Authorization: Bearer <jwt_or_supabase_token>
```

---

## 1. Authentication Endpoints

### POST `/auth/register`
Registers a new user account.
```json
// Request Body
{
  "fullName": "Aarav Sharma",
  "email": "aarav@budigo.app",
  "password": "securePassword123"
}

// Response 201 Created
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": {
    "id": "a0000000-0000-0000-0000-000000000001",
    "full_name": "Aarav Sharma",
    "email": "aarav@budigo.app"
  }
}
```

### POST `/auth/login`
Signs in with credentials.
```json
// Request Body
{
  "email": "aarav@budigo.app",
  "password": "securePassword123"
}

// Response 200 OK
{
  "success": true,
  "token": "eyJhbGciOi...",
  "user": { ... }
}
```

---

## 2. Room Management Endpoints

### POST `/rooms`
Creates a new travel room. The creator is automatically added as host with marker color `#D1956A`.
```json
// Request Body
{
  "roomName": "Goa Weekend Trip",
  "destinationName": "Baga Beach, North Goa",
  "destinationLatitude": 15.5553,
  "destinationLongitude": 73.7517,
  "destinationAddress": "Baga Beach Rd, Calangute, Goa"
}

// Response 201 Created
{
  "success": true,
  "room": {
    "id": "b0000000-0000-0000-0000-000000000001",
    "room_code": "BUD482",
    "room_name": "Goa Weekend Trip",
    "creator_id": "a0000000-...",
    "destination_name": "Baga Beach, North Goa",
    "destination_latitude": 15.5553,
    "destination_longitude": 73.7517,
    "status": "active"
  },
  "member": {
    "id": "rm_1",
    "display_name": "Aarav Sharma",
    "marker_color": "#D1956A",
    "member_role": "creator"
  }
}
```

### POST `/rooms/join`
Joins a room with a 6-character code and assigns the next distinct marker color.
```json
// Request Body
{
  "roomCode": "BUD482",
  "displayName": "Bhavna Patel",
  "shareLocation": true
}

// Response 200 OK
{
  "success": true,
  "room": { ... },
  "member": {
    "display_name": "Bhavna Patel",
    "marker_color": "#4C78C9",
    "member_role": "member",
    "location_sharing_enabled": true
  }
}
```

### GET `/rooms/:roomId`
Fetches room details, common destination, and member list.

### GET `/rooms/:roomId/members`
Fetches all members and their current statuses (`Not Started`, `On the Way`, `Moving`, `Arrived`, etc.).

### POST `/rooms/:roomId/leave`
Voluntarily leaves a room.

### PATCH `/rooms/:roomId/destination`
Updates the common trip destination (Creator only).

### POST `/rooms/:roomId/end`
Ends the trip and completes the room (Creator only).

---

## 3. Location Tracking Endpoints

### POST `/locations/update`
Transmits updated GPS telemetry. Evaluates proximity to destination, updates status, and broadcasts to room sockets.
```json
// Request Body
{
  "roomId": "b0000000-0000-0000-0000-000000000001",
  "latitude": 15.5186,
  "longitude": 73.7626,
  "accuracy": 4.5,
  "speed": 11.2,
  "heading": 340.0
}

// Response 200 OK
{
  "success": true,
  "status": "Moving",
  "distanceMeters": 4800,
  "etaSeconds": 720
}
```

### GET `/locations/rooms/:roomId/locations`
Returns current live GPS coordinates of all buddies with sharing enabled.

### POST `/locations/rooms/:roomId/toggle-sharing`
Pauses or resumes location sharing for the current member.

---

## 4. Smart Meeting Points & Voting Endpoints

### POST `/meeting-points/search`
Executes candidate discovery and the Minimax road optimization algorithm.
```json
// Request Body
{
  "roomId": "b0000000-0000-0000-0000-000000000001",
  "category": "cafe"
}

// Response 200 OK
{
  "success": true,
  "recommendations": [
    {
      "id": "mp_1",
      "place_name": "Café Chocolatti & Bakery",
      "address": "Fort Aguada Rd, Candolim, Goa",
      "rating": 4.7,
      "ranking_score": 94.5,
      "maximum_travel_time": 960,
      "total_travel_time": 2400,
      "average_travel_time": 600,
      "routes": [
        { "user_id": "u1", "duration_seconds": 600, "distance_meters": 4200 },
        { "user_id": "u2", "duration_seconds": 960, "distance_meters": 5800 }
      ]
    }
  ]
}
```

### POST `/meeting-points/:id/select`
Confirms the meeting point. Updates room destination and alerts all members.

### POST `/votes`
Casts or updates a member's vote for a candidate meeting point.
```json
// Request Body
{
  "roomId": "b0000000-0000-0000-0000-000000000001",
  "meetingPointId": "mp_1"
}

// Response 200 OK
{
  "success": true,
  "tallies": {
    "counts": { "mp_1": 3, "mp_2": 1 },
    "percentages": { "mp_1": 75, "mp_2": 25 },
    "totalVotes": 4
  }
}
```

---

## 5. Real-Time Socket.IO Protocol

| Event | Direction | Payload | Description |
|---|---|---|---|
| `room:join` | Client -> Server | `{ roomId }` | Authenticates socket & subscribes to room |
| `room:member-joined` | Server -> Client | `RoomMember` | Broadcast when new buddy enters |
| `location:update` | Client -> Server | `{ roomId, lat, lon, speed, heading }` | High-frequency telemetry |
| `location:broadcast` | Server -> Client | `LiveLocation & { markerColor, status }` | Relayed to room buddies |
| `trip:progress` | Server -> Client | `{ userId, distanceMeters, etaSeconds, status }` | Travel progress update |
| `trip:arrived` | Server -> Client | `{ userId, destinationName }` | Triggered after 2 confirmed arrival checks |
| `meeting:recommendations` | Server -> Client | `{ roomId, recommendations }` | Minimax top 3 recommendations |
| `meeting:vote` | Server -> Client | `{ meetingPointId, tallies }` | Live voting counts & % update |
| `meeting:confirmed` | Server -> Client | `MeetingPoint` | Confirmed meeting point synced on map |
| `notification:new` | Server -> Client | `NotificationItem` | Real-time push alert |

