import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/GetSSHConnectionByIdUseCase';

const GetSSHConnectionByIdController = createController(GetSSHConnectionByIdUseCase);
export default GetSSHConnectionByIdController;
