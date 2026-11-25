import { Router } from 'express';
import { RoomController } from '../controllers/roomController';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/authMiddleware';

const router = Router();

// Public / Guest accessible room viewing
router.get('/:roomId', optionalAuthMiddleware, RoomController.getRoom);
router.get('/:roomId/members', optionalAuthMiddleware, RoomController.getMembers);

// Protected room management
router.use(authMiddleware);

router.post('/', RoomController.createRoom);
router.post('/join', RoomController.joinRoom);
router.get('/my-trips', RoomController.getMyTrips);
router.post('/:roomId/leave', RoomController.leaveRoom);
router.patch('/:roomId/destination', RoomController.updateDestination);
router.post('/:roomId/end', RoomController.endRoom);

export default router;

