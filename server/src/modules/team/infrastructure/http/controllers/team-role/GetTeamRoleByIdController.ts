import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetTeamRoleByIdUseCase from '@modules/team/application/use-cases/team-role/GetTeamRoleByIdUseCase';

const GetTeamRoleByIdController = createController(GetTeamRoleByIdUseCase);
export default GetTeamRoleByIdController;
