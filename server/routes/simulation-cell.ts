import { Router } from 'express';
import * as controller from '@controllers/simulation-cell';
import * as authMiddleware from '@middlewares/authentication';

const router = Router();
router.use(authMiddleware.protect);

router.get('/', controller.getUserSimulationCells);

export default router;
