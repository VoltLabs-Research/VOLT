import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '../middlewares/check-team-membership';
import CreateTeamRoleController from '../controllers/team-role/CreateTeamRoleController';
import DeleteTeamRoleByIdController from '../controllers/team-role/DeleteTeamRoleByIdController';
import GetTeamRoleByIdController from '../controllers/team-role/GetTeamRoleByIdController';
import ListTeamRolesByTeamIdController from '../controllers/team-role/ListTeamRolesByTeamIdController';
import UpdateTeamRoleByIdController from '../controllers/team-role/UpdateTeamRoleByIdController';

const createTeamRoleController = container.resolve(CreateTeamRoleController);
const deleteTeamRoleByIdController = container.resolve(DeleteTeamRoleByIdController);
const getTeamRoleByIdController = container.resolve(GetTeamRoleByIdController);
const listTeamRolesByTeamIdController = container.resolve(ListTeamRolesByTeamIdController);
const updateTeamRoleByIdController = container.resolve(UpdateTeamRoleByIdController);

const router = Router();

router.use(protect, checkTeamMembership);

router.route('/:teamId')
    .get(listTeamRolesByTeamIdController.handle)
    .post(createTeamRoleController.handle);

router.route('/:teamId/:roleId/')
    .delete(deleteTeamRoleByIdController.handle)
    .get(getTeamRoleByIdController.handle)
    .patch(updateTeamRoleByIdController.handle);

export default router;