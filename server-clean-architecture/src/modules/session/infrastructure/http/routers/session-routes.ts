import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import GetActiveSessionsController from '../controllers/GetActiveSessionsController';
import GetMyLoginActivityController from '../controllers/GetMyLoginActivityController';
import RevokeAllSessionsController from '../controllers/RevokeAllSessionsController';
import RevokeSessionController from '../controllers/RevokeSessionController';

const getActiveSessionsController = container.resolve(GetActiveSessionsController);
const getMyLoginActivityController = container.resolve(GetMyLoginActivityController);
const revokeAllSessionsController = container.resolve(RevokeAllSessionsController);
const revokeSessionController = container.resolve(RevokeSessionController);

const router = Router();

router.use(protect);

router.get('/', getActiveSessionsController.handle);
router.patch('/:sessionId', revokeSessionController.handle);

router.get('/activity', getMyLoginActivityController.handle);
router.get('/all/others', revokeAllSessionsController.handle);

export default router;