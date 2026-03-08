import { Router } from 'express';
import { protect } from '@shared/infrastructure/http/middleware/authentication';
import controllers from '@modules/session/infrastructure/http/controllers';
import { HttpModule } from '@shared/infrastructure/http/routing/HttpModule';

const router = Router({ mergeParams: true });
const module: HttpModule = {
    basePath: '/api/session',
    router
};

router.use(protect);

router.get('/', controllers.getActiveSessions.handle);
router.patch('/:sessionId', controllers.revokeSessionById.handle);

router.get('/activity', controllers.getMyLoginActivity.handle);
router.delete('/all/others', controllers.revokeAllSessions.handle);

export default module;
