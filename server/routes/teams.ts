import { Router } from 'express';
import TeamController from '@controllers/team';
import * as authMiddleware from '@middlewares/authentication';
import * as middleware from '@middlewares/team';

const router = Router();
const controller = new TeamController();

router.use(authMiddleware.protect);
router.route('/')
    .get(controller.getAll)
    .post(controller.createOne);

router.route('/:id')
    .get(middleware.checkTeamMembership, controller.getOne)
    .patch(middleware.checkTeamOwnership, controller.updateOne)
    .delete(middleware.checkTeamOwnership, controller.deleteOne);

// Leave team endpoint
router.post('/:id/leave', controller.leaveTeam);

// Get team members
router.get('/:id/members', middleware.checkTeamMembership, controller.getMembers);

// Remove member from team
router.post('/:id/members/remove', middleware.checkTeamOwnership, controller.removeMember);

export default router;
