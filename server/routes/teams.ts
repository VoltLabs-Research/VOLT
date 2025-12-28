import express from 'express';
import TeamController from '@/controllers/team';
import teamRolesRouter from '@/routes/team-roles';
import * as authMiddleware from '@middlewares/authentication';
import * as middleware from '@middlewares/team';

const router = express.Router();
const teamController = new TeamController();

router.use(authMiddleware.protect);

router.route('/')
    .get(teamController.getAll)
    .post(teamController.createOne);

router.use('/:id/roles', teamRolesRouter);

router.route('/:id')
    .get(middleware.checkTeamMembership, teamController.getOne)
    .patch(middleware.checkTeamOwnership, teamController.updateOne)
    .delete(middleware.checkTeamOwnership, teamController.deleteOne);

router.post('/:id/leave', middleware.checkTeamMembership, teamController.leaveTeam);

router.get('/:id/members', middleware.checkTeamMembership, teamController.getMembers);

router.post('/:id/members/remove', middleware.checkTeamMembership, teamController.removeMember);

export default router;

