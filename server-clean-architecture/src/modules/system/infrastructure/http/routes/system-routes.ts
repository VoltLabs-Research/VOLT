import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers';

const router = Router();

router.use(protect);

router.get('/stats', controllers.getSystemStats.handle);
router.get('/rbac', controllers.getRbacConfig.handle)

export default router;
