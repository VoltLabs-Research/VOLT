import { Router } from 'express';
import { container } from 'tsyringe';
import { GetSystemStatsController } from '../controllers/GetSystemStatsController';
import { GetRBACConfigController } from '../controllers/GetRBACConfigController';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';

const router = Router();

const getSystemStatsController = container.resolve(GetSystemStatsController);
const getRBACConfigController = container.resolve(GetRBACConfigController);

router.get('/stats', protect, (req, res, next) => getSystemStatsController.handle(req, res, next));
router.get('/rbac', protect, (req, res, next) => getRBACConfigController.handle(req, res, next)); // Aliased for frontend
router.get('/rbac-config', protect, (req, res, next) => getRBACConfigController.handle(req, res, next));

export default router;
