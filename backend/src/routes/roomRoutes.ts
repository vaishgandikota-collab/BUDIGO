import { Router } from 'express';
import { RoomController } from '../controllers/roomController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Static routes must be registered before parameterized /:roomId routes
router.get('/my-trips', authMiddleware, RoomController.getMyTrips);
router.post('/join', authMiddleware, RoomController.joinRoom);
router.post('/', authMiddleware, RoomController.createRoom);

// Public / Guest accessible room viewing
router.get('/:roomId/members', optionalAuthMiddleware, RoomController.getMembers);
router.get('/:roomId', optionalAuthMiddleware, RoomController.getRoom);

// Parameterized protected room actions
router.post('/:roomId/leave', authMiddleware, RoomController.leaveRoom);
router.patch('/:roomId/destination', authMiddleware, RoomController.updateDestination);
router.post('/:roomId/end', authMiddleware, RoomController.endRoom);

export default router;

