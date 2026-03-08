import { createController } from '@shared/infrastructure/http/controllers/createController';
import { TestSSHConnectionByIdUseCase } from '@modules/ssh/application/use-cases/TestSSHConnectionByIdUseCase';

const TestSSHConnectionByIdController = createController(TestSSHConnectionByIdUseCase);
export default TestSSHConnectionByIdController;
