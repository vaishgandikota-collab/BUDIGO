import { Router } from 'express';
import { VoteController } from '../controllers/voteController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

router.use(authMiddleware);

router.post('/', VoteController.castVote);
router.get('/rooms/:roomId/votes', VoteController.getRoomVotes);

export default router;

