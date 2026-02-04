import { Router } from 'express';
import DailyActivityController from '@/controllers/daily-activity';
import * as teamMiddleware from '@/middlewares/team';
import * as authMiddleware from '@/middlewares/authentication';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new DailyActivityController();
const rbac = new RBACMiddleware(controller, router);

router.use(authMiddleware.protect);

rbac.groupBy(Action.READ, teamMiddleware.checkTeamMembership)
    .route('/', controller.getTeamActivity);

export default router;