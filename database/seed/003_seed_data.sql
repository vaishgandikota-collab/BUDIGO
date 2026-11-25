-- ===================================================================
-- BUDIGO REALISTIC SEED DATA FOR TESTING & PREVIEWS
-- Trip: Goa Weekend Trip -> Baga Beach
-- ===================================================================

-- 1. Profiles
INSERT INTO profiles (id, full_name, email, avatar_url, phone)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Aarav Sharma', 'aarav@budigo.app', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80', '+919876543210'),
    ('a0000000-0000-0000-0000-000000000002', 'Bhavna Patel', 'bhavna@budigo.app', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80', '+919876543211'),
    ('a0000000-0000-0000-0000-000000000003', 'Chetan Rao', 'chetan@budigo.app', 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?auto=format&fit=crop&w=200&q=80', '+919876543212'),
    ('a0000000-0000-0000-0000-000000000004', 'Divya Nair', 'divya@budigo.app', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80', '+919876543213')
ON CONFLICT (id) DO NOTHING;

-- 2. Room
INSERT INTO rooms (id, room_code, room_name, creator_id, destination_name, destination_latitude, destination_longitude, destination_address, status)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'BUD482',
    'Goa Weekend Trip',
    'a0000000-0000-0000-0000-000000000001',
    'Baga Beach, North Goa',
    15.5553,
    73.7517,
    'Baga Beach Rd, Calangute, Goa 403516',
    'active'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Room Members with Distinct Palette Colors
-- Colors: Terracotta (#D1956A), Blue (#4C78C9), Green (#419A77), Purple (#8B6BC1)
INSERT INTO room_members (id, room_id, user_id, display_name, marker_color, member_role, location_sharing_enabled, status)
VALUES
    ('c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Aarav (You)', '#D1956A', 'creator', true, 'On the Way'),
    ('c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'Bhavna', '#4C78C9', 'member', true, 'Moving'),
    ('c0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000003', 'Chetan', '#419A77', 'member', true, 'Near Destination'),
    ('c0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 'Divya', '#8B6BC1', 'member', true, 'Arrived')
ON CONFLICT (room_id, user_id) DO NOTHING;

-- 4. Live Locations (Realistic Goa Coordinates)
INSERT INTO live_locations (room_id, user_id, latitude, longitude, accuracy, speed, heading, distance_to_dest_meters, eta_seconds)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 15.4989, 73.8278, 4.2, 12.5, 310.0, 11200, 1320), -- Panaji
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 15.5186, 73.7626, 3.8, 8.2, 345.0, 4800, 720),   -- Candolim
    ('b0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 15.5412, 73.7554, 5.0, 6.0, 15.0, 1700, 310),    -- Calangute
    ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000004', 15.5548, 73.7521, 2.5, 0.0, 0.0, 80, 0)          -- At Baga
ON CONFLICT (room_id, user_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    updated_at = now();

-- 5. Meeting Points (Generated Candidates Ranked by Minimax)
INSERT INTO meeting_points (id, room_id, place_id, place_name, category, latitude, longitude, address, rating, ranking_score, maximum_travel_time, total_travel_time, average_travel_time, is_confirmed)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'ChIJ_goa_cafe_01', 'Café Chocolatti & Bakery', 'cafe', 15.5245, 73.7650, 'Fort Aguada Rd, Candolim, Goa', 4.7, 94.5, 960, 2400, 600, false),
    ('d0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'ChIJ_goa_rest_02', 'Pousada By The Beach', 'restaurant', 15.5340, 73.7590, 'Holiday St, Calangute, Goa', 4.6, 88.0, 1140, 2760, 690, false),
    ('d0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000001', 'ChIJ_goa_mall_03', 'Mall De Goa Landmark', 'shopping_mall', 15.5190, 73.8320, 'NH 66, Porvorim, Goa', 4.3, 76.2, 1380, 3420, 855, false)
ON CONFLICT (id) DO NOTHING;

-- 6. Votes
INSERT INTO votes (room_id, meeting_point_id, user_id)
VALUES
    ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001'),
    ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002'),
    ('b0000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003')
ON CONFLICT (room_id, user_id) DO NOTHING;

-- 7. Notifications
INSERT INTO notifications (user_id, room_id, title, message, notification_type)
VALUES
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Divya has Arrived! 🎉', 'Divya Nair reached Baga Beach, North Goa.', 'trip:arrived'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'New Meeting Point Recommended', 'Café Chocolatti & Bakery discovered as optimal meeting point (16 min max ETA).', 'meeting:recommendations'),
    ('a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Bhavna joined room', 'Bhavna Patel joined Goa Weekend Trip.', 'room:member-joined')
ON CONFLICT DO NOTHING;

