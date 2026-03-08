import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { GetSSHConnectionsByTeamIdUseCase } from '@modules/ssh/application/use-cases/GetSSHConnectionsByTeamIdUseCase';

const GetSSHConnectionsByTeamIdController = createPaginatedController(GetSSHConnectionsByTeamIdUseCase);
export default GetSSHConnectionsByTeamIdController;
