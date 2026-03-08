import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { CreateSSHConnectionUseCase } from '@modules/ssh/application/use-cases/CreateSSHConnectionUseCase';

const CreateSSHConnectionController = createController(CreateSSHConnectionUseCase, HttpStatus.Created);
export default CreateSSHConnectionController;
