import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetTeamByIdUseCase from '@modules/team/application/use-cases/team/GetTeamByIdUseCase';

const GetTeamByIdController = createController(GetTeamByIdUseCase);
export default GetTeamByIdController;
