import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdateTeamMemberByIdUseCase from '@modules/team/application/use-cases/team-member/UpdateTeamMemberByIdUseCase';

const UpdateTeamMemberByIdController = createController(UpdateTeamMemberByIdUseCase);
export default UpdateTeamMemberByIdController;
