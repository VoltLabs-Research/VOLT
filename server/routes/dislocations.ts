import { Router } from 'express';
import * as controller from '@controllers/dislocations';
import * as authMiddleware from '@middlewares/authentication';

const router = Router();
router.use(authMiddleware.protect);

router.get('/', controller.getUserDislocations);

export default router;