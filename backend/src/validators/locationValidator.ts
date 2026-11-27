import { z } from 'zod';

export const updateLocationSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
  speed: z.number().optional(),
  heading: z.number().optional(),
  timestamp: z.number().optional(),
});

export const routeCalculateSchema = z.object({
  origin: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  destination: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
  travelMode: z.enum(['DRIVE', 'WALK', 'BICYCLE']).default('DRIVE'),
});

export const searchMeetingPointsSchema = z.object({
  roomId: z.string().min(1),
  category: z.enum([
    'all',
    'cafe',
    'restaurant',
    'shopping_mall',
    'tourist_attraction',
    'park',
    'hotel',
    'parking',
    'transit_station',
    'metro_station',
    'bus_station',
    'popular_landmarks',
  ]).default('all'),
  radiusMeters: z.number().min(500).max(50000).optional().default(2000),
  mode: z.enum(['near_destination', 'fair_for_everyone']).optional().default('near_destination'),
  destination: z.object({
    name: z.string(),
    address: z.string().optional(),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }).optional(),
  customParticipants: z.array(z.object({
    userId: z.string(),
    displayName: z.string(),
    markerColor: z.string(),
    latitude: z.number(),
    longitude: z.number(),
  })).optional(),
});

