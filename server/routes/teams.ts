import { Router } from 'express';
import * as controller from '@controllers/team';
import * as authMiddleware from '@middlewares/authentication';
import * as middleware from '@middlewares/team';

const router = Router();

router.use(authMiddleware.protect);
router.route('/')
    .get(controller.getUserTeams)
    .post(controller.createTeam);

router.route('/:id')
    .get(middleware.checkTeamMembership, controller.getTeamById)
    .patch(middleware.checkTeamOwnership, controller.updateTeam)
    .delete(middleware.checkTeamOwnership, controller.deleteTeam);

// Leave team endpoint
router.post('/:id/leave', controller.leaveTeam);

export default router;
