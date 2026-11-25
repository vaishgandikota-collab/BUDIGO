import { Router } from 'express';
import { LocationController } from '../controllers/locationController';
import { authMiddleware } from '../middleware/authMiddleware';
import { locationLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(authMiddleware);

router.post('/update', locationLimiter, LocationController.updateLocation);
router.get('/rooms/:roomId/locations', LocationController.getRoomLocations);
router.post('/rooms/:roomId/toggle-sharing', LocationController.toggleLocationSharing);

export default router;

