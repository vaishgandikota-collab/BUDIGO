-- ===================================================================
-- BUDIGO ROW LEVEL SECURITY (RLS) POLICIES
-- Strict Isolation & Privacy Protection for Sensitive Location Data
-- ===================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_point_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------
-- 1. Profiles Policies
-- -------------------------------------------------------------
-- Users can view their own profile and profiles of co-members in shared rooms
CREATE POLICY "Profiles viewable by self and room mates"
ON profiles FOR SELECT
USING (
    auth.uid() = id OR
    EXISTS (
        SELECT 1 FROM room_members rm1
        JOIN room_members rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = auth.uid() AND rm2.user_id = profiles.id
    )
);

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

-- -------------------------------------------------------------
-- 2. Rooms Policies
-- -------------------------------------------------------------
-- Any authenticated user can view rooms they are members of or look up by code to join
CREATE POLICY "Rooms viewable by members or creators"
ON rooms FOR SELECT
USING (
    creator_id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM room_members
        WHERE room_members.room_id = rooms.id AND room_members.user_id = auth.uid()
    )
);

CREATE POLICY "Authenticated users can create rooms"
ON rooms FOR INSERT
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creator can update their room"
ON rooms FOR UPDATE
USING (auth.uid() = creator_id);

-- -------------------------------------------------------------
-- 3. Room Members Policies
-- -------------------------------------------------------------
CREATE POLICY "Room members viewable by fellow room members"
ON room_members FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM room_members rm
        WHERE rm.room_id = room_members.room_id AND rm.user_id = auth.uid()
    )
);

CREATE POLICY "Users can join rooms"
ON room_members FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own membership status"
ON room_members FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Creator can remove members or user can leave"
ON room_members FOR DELETE
USING (
    auth.uid() = user_id OR
    EXISTS (
        SELECT 1 FROM rooms
        WHERE rooms.id = room_members.room_id AND rooms.creator_id = auth.uid()
    )
);

-- -------------------------------------------------------------
-- 4. Live Locations Policies
-- Only members of the same room with active location sharing can read
-- -------------------------------------------------------------
CREATE POLICY "Locations viewable only by active room members"
ON live_locations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM room_members viewer_rm
        WHERE viewer_rm.room_id = live_locations.room_id
          AND viewer_rm.user_id = auth.uid()
    )
    AND EXISTS (
        SELECT 1 FROM room_members sharer_rm
        WHERE sharer_rm.room_id = live_locations.room_id
          AND sharer_rm.user_id = live_locations.user_id
          AND sharer_rm.location_sharing_enabled = true
    )
);

CREATE POLICY "Users can insert or update only their own live location"
ON live_locations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own location"
ON live_locations FOR UPDATE
USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 5. Meeting Points & Routes Policies
-- -------------------------------------------------------------
CREATE POLICY "Meeting points viewable by room members"
ON meeting_points FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM room_members
        WHERE room_members.room_id = meeting_points.room_id AND room_members.user_id = auth.uid()
    )
);

CREATE POLICY "Meeting point routes viewable by room members"
ON meeting_point_routes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM meeting_points mp
        JOIN room_members rm ON rm.room_id = mp.room_id
        WHERE mp.id = meeting_point_routes.meeting_point_id AND rm.user_id = auth.uid()
    )
);

-- -------------------------------------------------------------
-- 6. Votes Policies
-- -------------------------------------------------------------
CREATE POLICY "Votes viewable by room members"
ON votes FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM room_members
        WHERE room_members.room_id = votes.room_id AND room_members.user_id = auth.uid()
    )
);

CREATE POLICY "Room members can cast their own vote"
ON votes FOR INSERT
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM room_members
        WHERE room_members.room_id = votes.room_id AND room_members.user_id = auth.uid()
    )
);

CREATE POLICY "Room members can update their own vote"
ON votes FOR UPDATE
USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 7. Notifications Policies
-- -------------------------------------------------------------
CREATE POLICY "Users can only view their own notifications"
ON notifications FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification read status"
ON notifications FOR UPDATE
USING (auth.uid() = user_id);

