import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '../middlewares/check-team-membership';
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

router.use(protect);

router.route('/:teamId')
    .all(checkTeamMembership)
    .get(listTeamInvitationsController.handle);

router.post('/:teamId/invite', checkTeamMembership, createTeamInvitationController.handle);
router.get('/:teamId/pending', checkTeamMembership, listTeamInvitationsController.handle);
router.get('/:teamId/details/:token', getTeamInvitationByIdController.handle);
router.post('/:teamId/accept/:token', updateTeamInvitationsByIdController.handle);
router.post('/:teamId/reject/:token', deleteTeamInvitationByIdController.handle);
router.delete('/:teamId/cancel/:invitationId', deleteTeamInvitationByIdController.handle);

// Generic route for ID access if needed (fallback)
// But /:teamId is for list.


router.route('/:teamId/:invitationId')
    .get(getTeamInvitationByIdController.handle)
    .patch(updateTeamInvitationsByIdController.handle)
    .delete(deleteTeamInvitationByIdController.handle);

export default router;