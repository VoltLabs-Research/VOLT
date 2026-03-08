import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdateTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/UpdateTeamRoleByIdUseCase';

const UpdateTeamRoleByIdController = createController(UpdateTeamRoleByIdUseCase);
export default UpdateTeamRoleByIdController;
