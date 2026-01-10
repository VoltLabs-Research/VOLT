import { Router } from 'express';
import { container } from 'tsyringe';
import { protect } from '@/src/shared/infrastructure/http/middleware/authentication';
import { checkTeamMembership } from '../middlewares/check-team-membership';
import CreateTeamMemberController from '../controllers/team-member/CreateTeamMemberController';
import DeleteTeamMemberByIdController from '../controllers/team-member/DeleteTeamMemberByIdController';
import GetTeamMemberByIdController from '../controllers/team-member/GetTeamMemberByIdController';
import ListTeamMembersByTeamIdController from '../controllers/team-member/ListTeamMembersByTeamIdController';
import UpdateTeamMemberByIdController from '../controllers/team-member/UpdateTeamMemberByIdController';

const createTeamMemberController = container.resolve(CreateTeamMemberController);
const deleteTeamMemberByIdController = container.resolve(DeleteTeamMemberByIdController);
const getTeamMemberByIdController = container.resolve(GetTeamMemberByIdController);
const listTeamMembersByTeamIdController = container.resolve(ListTeamMembersByTeamIdController);
const updateTeamMemberByIdController = container.resolve(UpdateTeamMemberByIdController);

const router = Router();

router.use(protect, checkTeamMembership);

router.route('/:teamId')
    .get(listTeamMembersByTeamIdController.handle)
    .post(createTeamMemberController.handle);

router.route('/:teamId/:teamMemberId')
    .get(getTeamMemberByIdController.handle)
    .patch(updateTeamMemberByIdController.handle)
    .delete(deleteTeamMemberByIdController.handle);

export default router;