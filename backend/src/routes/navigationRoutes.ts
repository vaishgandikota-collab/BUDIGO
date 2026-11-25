import { Router } from 'express';
import { NavigationController } from '../controllers/navigationController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';
import { routeCalculationLimiter } from '../middleware/rateLimiter';

const router = Router();

// Place Search & Autocomplete: Supports optional auth so users can search destinations freely
router.post('/places/search', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.searchPlaces);
router.get('/places/search', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.searchPlaces);
router.post('/places/autocomplete', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.autocomplete);
router.get('/places/autocomplete', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.autocomplete);
router.get('/places/:placeId/details', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.getPlaceDetails);
router.post('/places/reverse-geocode', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.reverseGeocode);
router.get('/places/reverse-geocode', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.reverseGeocode);

// Route calculation and Matrix supports optional auth for discovery and authenticated rooms
router.post('/calculate', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.calculateRoute);
router.post('/matrix', optionalAuthMiddleware, routeCalculationLimiter, NavigationController.computeMatrix);

export default router;


