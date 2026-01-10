import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '../middlewares/check-team-membership';
import CreateTeamController from '../controllers/team/CreateTeamController';
import DeleteTeamByIdController from '../controllers/team/DeleteTeamByIdController';
import GetTeamByIdController from '../controllers/team/GetTeamByIdController';
import ListUserTeamsController from '../controllers/team/ListUserTeamsController';
import RemoveUserFromTeamController from '../controllers/team/RemoveUserFromTeamController';
import UpdateTeamByIdController from '../controllers/team/UpdateTeamByIdController';

const createTeamController = container.resolve(CreateTeamController);
const deleteTeamByIdController = container.resolve(DeleteTeamByIdController);
const getTeamByIdController = container.resolve(GetTeamByIdController);
const listUserTeamsController = container.resolve(ListUserTeamsController);
const removeUserFromTeamController = container.resolve(RemoveUserFromTeamController);
const updateTeamByIdController = container.resolve(UpdateTeamByIdController);

const router = Router();

router.use(protect);

router.route('/')
    .get(listUserTeamsController.handle)
    .post(createTeamController.handle);

router.use(checkTeamMembership);

router.route('/:teamId')
    .get(getTeamByIdController.handle)
    .patch(updateTeamByIdController.handle)
    .delete(deleteTeamByIdController.handle);

router.post('/:id/members/remove', removeUserFromTeamController.handle);

export default router;