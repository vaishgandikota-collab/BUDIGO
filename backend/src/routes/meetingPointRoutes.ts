import { Router } from 'express';
import { MeetingPointController } from '../controllers/meetingPointController';
import { optionalAuthMiddleware } from '../middleware/authMiddleware';
import { routeCalculationLimiter } from '../middleware/rateLimiter';

const router = Router();

router.use(optionalAuthMiddleware);

router.post('/discover-areas', routeCalculationLimiter, MeetingPointController.discoverFairAreas);
router.post('/discover-venues', routeCalculationLimiter, MeetingPointController.discoverAreaVenues);

router.post('/search', routeCalculationLimiter, MeetingPointController.searchMeetingPoints);
router.get('/rooms/:roomId/meeting-points', MeetingPointController.getMeetingPoints);
router.post('/:id/select', MeetingPointController.selectMeetingPoint);
router.post('/:id/confirm', MeetingPointController.selectMeetingPoint);

export default router;

