import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers';

const router = Router();

router.use(protect);

router.get('/', controllers.getActiveSessions.handle);
router.patch('/:sessionId', controllers.revokeSessionById.handle);

router.get('/activity', controllers.getMyLoginActivity.handle);
router.get('/all/others', controllers.revokeAllSessions.handle);

export default router;