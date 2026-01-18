import { Router } from 'express';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import controllers from '../controllers';

const router = Router();

router.use(protect);

router.get('/', controllers.getByUserId.handle);
router.patch('/read-all', controllers.readAll.handle);

export default router;