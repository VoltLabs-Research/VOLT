import { Router } from 'express';
import TeamInvitationController from '@/controllers/team/team-invitation';
import * as authMiddleware from '@middlewares/authentication';
import * as middleware from '@middlewares/team-invitation';
import RBACMiddleware from '@/middlewares/rbac';
import { Action } from '@/constants/permissions';

const router = Router();
const controller = new TeamInvitationController();
const rbac = new RBACMiddleware(controller, router);

router.use(authMiddleware.protect);

rbac.groupBy(Action.READ, middleware.loadInvitationByToken)
    .route('/details/:token', controller.getInvitationDetails);

rbac.groupBy(Action.READ, middleware.verifyTeamOwnership)
    .route('/pending', controller.getPendingInvitations);

rbac.groupBy(Action.CREATE, middleware.loadInvitationByToken, middleware.verifyInvitationRecipient)
    .route('/accept/:token', controller.acceptTeamInvitation)
    .route('/reject/:token', controller.rejectTeamInvitation);

rbac.groupBy(Action.CREATE, middleware.verifyTeamOwnership, middleware.validateInvitationBody)
    .route('/invite', controller.sendTeamInvitation);

rbac.groupBy(Action.DELETE, middleware.verifyTeamOwnership)
    .route('/cancel/:invitationId', controller.cancelInvitation);

export default router;
