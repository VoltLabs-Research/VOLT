import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import CreateTeamInvitationController from '../controllers/team-invitation/CreateTeamInvitationController';
import DeleteTeamInvitationByIdController from '../controllers/team-invitation/DeleteTeamInvitationByIdController';
import GetTeamInvitationByIdController from '../controllers/team-invitation/GetTeamInvitationByIdController';
import ListTeamInvitationsController from '../controllers/team-invitation/ListTeamInvitationsController';
import UpdateTeamInvitationByIdController from '../controllers/team-invitation/UpdateTeamInvitationByIdController';

const createTeamInvitationController = container.resolve(CreateTeamInvitationController);
const deleteTeamInvitationByIdController = container.resolve(DeleteTeamInvitationByIdController);
const getTeamInvitationByIdController = container.resolve(GetTeamInvitationByIdController);
const listTeamInvitationsController = container.resolve(ListTeamInvitationsController);
const updateTeamInvitationsByIdController = container.resolve(UpdateTeamInvitationByIdController);

const router = Router();

router.use(protect, /* checkTeamMembership */);

router.route('/:teamId')
    .get(listTeamInvitationsController.handle)
    .post(createTeamInvitationController.handle);

router.route('/:teamId/:invitationId')
    .get(getTeamInvitationByIdController.handle)
    .patch(updateTeamInvitationsByIdController.handle)
    .delete(deleteTeamInvitationByIdController.handle);

export default router;