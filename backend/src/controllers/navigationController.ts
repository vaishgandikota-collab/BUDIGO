import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/authMiddleware';
import { routeCalculateSchema } from '../validators/locationValidator';
import { GoogleMapsService } from '../services/googleMapsService';

export class NavigationController {
  static async calculateRoute(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = routeCalculateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, errors: parsed.error.format() });
      }

      const { origin, destination, travelMode } = parsed.data;

      const result = await GoogleMapsService.calculateRoute(origin, destination, travelMode);

      return res.json({
        success: true,
        route: result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async computeMatrix(req: AuthenticatedRequest, res: Response) {
    try {
      const { origins, destinations } = req.body;
      if (!Array.isArray(origins) || !Array.isArray(destinations)) {
        return res.status(400).json({ success: false, error: 'origins and destinations arrays required' });
      }

      const matrix = await GoogleMapsService.computeRouteMatrix(origins, destinations);

      // Convert Map to plain object for JSON response
      const obj: Record<string, Record<string, any>> = {};
      for (const [destId, origMap] of matrix.entries()) {
        obj[destId] = {};
        for (const [userId, stats] of origMap.entries()) {
          obj[destId][userId] = stats;
        }
      }

      return res.json({
        success: true,
        matrix: obj,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async searchPlaces(req: AuthenticatedRequest, res: Response) {
    try {
      const query = (req.body.query || req.query.query || '') as string;
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Search query must be at least 2 characters',
        });
      }

      const maxResults = Math.min(10, Math.max(1, Number(req.body.maxResults || req.query.maxResults || 6)));
      const places = await GoogleMapsService.searchPlacesByText(query, maxResults);

      return res.json({
        success: true,
        places,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async autocomplete(req: AuthenticatedRequest, res: Response) {
    try {
      const input = (req.body.input || req.query.input || '') as string;
      const sessionToken = (req.body.sessionToken || req.query.sessionToken) as string | undefined;
      if (!input || input.trim().length < 2) {
        return res.json({ success: true, suggestions: [] });
      }

      const suggestions = await GoogleMapsService.autocompletePlaces(input, sessionToken);
      return res.json({
        success: true,
        suggestions,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async getPlaceDetails(req: AuthenticatedRequest, res: Response) {
    try {
      const { placeId } = req.params;
      const sessionToken = (req.query.sessionToken || req.body.sessionToken) as string | undefined;
      if (!placeId) {
        return res.status(400).json({ success: false, error: 'placeId parameter is required' });
      }

      const details = await GoogleMapsService.getPlaceDetails(placeId, sessionToken);
      return res.json({
        success: true,
        details,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  static async reverseGeocode(req: AuthenticatedRequest, res: Response) {
    try {
      const latitude = Number(req.body.latitude || req.query.latitude);
      const longitude = Number(req.body.longitude || req.query.longitude);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          error: 'Valid numeric latitude and longitude required.',
        });
      }

      const result = await GoogleMapsService.reverseGeocode({ latitude, longitude });
      return res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }
}


