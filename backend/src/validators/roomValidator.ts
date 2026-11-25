import { z } from 'zod';

export const createRoomSchema = z.object({
  roomName: z.string().min(2, 'Room name must be at least 2 characters').max(60),
  destinationName: z.string().min(2, 'Destination name is required'),
  destinationLatitude: z.number().min(-90).max(90),
  destinationLongitude: z.number().min(-180).max(180),
  destinationAddress: z.string().optional(),
  destinationPlaceId: z.string().optional(),
  placeId: z.string().optional(),
});

export const joinRoomSchema = z.object({
  roomCode: z.string().min(4).max(10).toUpperCase(),
  displayName: z.string().min(1, 'Display name is required').max(40),
  avatarUrl: z.string().url().optional(),
  shareLocation: z.boolean().default(true),
});

export const updateDestinationSchema = z.object({
  destinationName: z.string().min(2),
  destinationLatitude: z.number().min(-90).max(90),
  destinationLongitude: z.number().min(-180).max(180),
  destinationAddress: z.string().optional(),
  destinationPlaceId: z.string().optional(),
  placeId: z.string().optional(),
});

