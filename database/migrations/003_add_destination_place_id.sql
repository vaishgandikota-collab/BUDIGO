-- Migration: 003_add_destination_place_id.sql
-- Description: Add Google Place ID column to rooms table for persistent location anchoring

ALTER TABLE rooms ADD COLUMN IF NOT EXISTS destination_place_id TEXT;
CREATE INDEX IF NOT EXISTS idx_rooms_place_id ON rooms(destination_place_id);
