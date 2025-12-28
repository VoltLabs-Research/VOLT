import { Router } from 'express';
import TeamMemberController from '@/controllers/team-member';
import * as authMiddleware from '@/middlewares/authentication';
import * as teamMiddleware from '@/middlewares/team';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new TeamMemberController();
const rbac = new RBACMiddleware(controller, router);

router.use(authMiddleware.protect);

rbac.groupBy(Action.READ, teamMiddleware.checkTeamMembership)
    .route('/', controller.getAll);

rbac.groupBy(Action.UPDATE, teamMiddleware.checkTeamMembership)
    .route('/:id', controller.updateOne);

export default router;