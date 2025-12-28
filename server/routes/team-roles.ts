import  { Router } from 'express';
import TeamRoleController from '@/controllers/team-role';
import * as authMiddleware from '@middlewares/authentication';
import * as teamMiddleware from '@middlewares/team';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new TeamRoleController();
const rbac = new RBACMiddleware(controller, router);

router.use(authMiddleware.protect);

rbac.groupBy(Action.READ, teamMiddleware.checkTeamMembership)
    .route('/', controller.getRoles)
    .route('/members', controller.getMembers);

rbac.groupBy(Action.CREATE, teamMiddleware.checkTeamMembership)
    .route('/', controller.createRole);

rbac.groupBy(Action.UPDATE, teamMiddleware.checkTeamMembership)
    .route('/:roleId', controller.updateRole)
    .route('/members/:memberId/role', controller.assignRole);

rbac.groupBy(Action.DELETE, teamMiddleware.checkTeamMembership)
    .route('/:roleId', controller.deleteRole);

export default router;
