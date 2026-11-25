-- ===================================================================
-- BUDIGO DATABASE SCHEMA - PRODUCTION READY
-- Group Travel, Real-Time Location Sharing & Smart Meeting Point Optimization
-- ===================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if re-running
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS meeting_point_routes CASCADE;
DROP TABLE IF EXISTS meeting_points CASCADE;
DROP TABLE IF EXISTS live_locations CASCADE;
DROP TABLE IF EXISTS room_members CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 1. Profiles Table
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    phone TEXT,
    push_token TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Rooms Table
CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_code VARCHAR(10) UNIQUE NOT NULL,
    room_name TEXT NOT NULL,
    creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    destination_name TEXT NOT NULL,
    destination_latitude DOUBLE PRECISION NOT NULL,
    destination_longitude DOUBLE PRECISION NOT NULL,
    destination_address TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    ended_at TIMESTAMPTZ
);

-- 3. Room Members Table
CREATE TABLE room_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    marker_color VARCHAR(10) NOT NULL,
    member_role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (member_role IN ('creator', 'member')),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    location_sharing_enabled BOOLEAN NOT NULL DEFAULT true,
    status VARCHAR(30) NOT NULL DEFAULT 'Not Started' CHECK (
        status IN ('Not Started', 'On the Way', 'Moving', 'Stopped', 'Near Destination', 'Arrived', 'Offline')
    ),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_room_member UNIQUE (room_id, user_id)
);

-- 4. Live Locations Table
CREATE TABLE live_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    distance_to_dest_meters INT,
    eta_seconds INT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_live_location UNIQUE (room_id, user_id)
);

-- 5. Meeting Points Table
CREATE TABLE meeting_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    place_id TEXT,
    place_name TEXT NOT NULL,
    category VARCHAR(50),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    photo_url TEXT,
    rating DOUBLE PRECISION,
    ranking_score DOUBLE PRECISION NOT NULL DEFAULT 0,
    maximum_travel_time INT NOT NULL DEFAULT 0, -- Minimax metric
    total_travel_time INT NOT NULL DEFAULT 0,   -- Secondary sum metric
    average_travel_time INT NOT NULL DEFAULT 0,
    is_confirmed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Meeting Point Routes (Travel Times per Participant)
CREATE TABLE meeting_point_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_point_id UUID NOT NULL REFERENCES meeting_points(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    distance_meters INT NOT NULL DEFAULT 0,
    duration_seconds INT NOT NULL DEFAULT 0,
    polyline TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_meeting_route UNIQUE (meeting_point_id, user_id)
);

-- 7. Votes Table (One active vote per user per room)
CREATE TABLE votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    meeting_point_id UUID NOT NULL REFERENCES meeting_points(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT uq_user_room_vote UNIQUE (room_id, user_id)
);

-- 8. Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ===================================================================
-- INDEXES FOR MAXIMUM QUERY PERFORMANCE
-- ===================================================================

CREATE INDEX idx_rooms_code ON rooms(room_code);
CREATE INDEX idx_rooms_creator ON rooms(creator_id);
CREATE INDEX idx_rooms_status ON rooms(status);

CREATE INDEX idx_room_members_room ON room_members(room_id);
CREATE INDEX idx_room_members_user ON room_members(user_id);
CREATE INDEX idx_room_members_sharing ON room_members(room_id, location_sharing_enabled);

CREATE INDEX idx_live_locations_room ON live_locations(room_id);
CREATE INDEX idx_live_locations_user ON live_locations(user_id);
CREATE INDEX idx_live_locations_updated ON live_locations(updated_at);

CREATE INDEX idx_meeting_points_room ON meeting_points(room_id);
CREATE INDEX idx_meeting_point_routes_mp ON meeting_point_routes(meeting_point_id);
CREATE INDEX idx_votes_room ON votes(room_id);
CREATE INDEX idx_votes_mp ON votes(meeting_point_id);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

