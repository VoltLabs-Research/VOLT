import { CreateContainerPortAccessUrlUseCase } from '@modules/container/application/use-cases/CreateContainerPortAccessUrlUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateContainerPortAccessUrlUseCase, {
});
