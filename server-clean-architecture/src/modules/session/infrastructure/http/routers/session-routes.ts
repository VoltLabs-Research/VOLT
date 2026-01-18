import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers';
import { HttpModule } from '@/src/shared/infrastructure/http/HttpModule';

const router = Router();
const module: HttpModule = {
    basePath: '/api/session',
    router
};

router.use(protect);

router.get('/', controllers.getActiveSessions.handle);
router.patch('/:sessionId', controllers.revokeSessionById.handle);

router.get('/activity', controllers.getMyLoginActivity.handle);
router.get('/all/others', controllers.revokeAllSessions.handle);

export default module;