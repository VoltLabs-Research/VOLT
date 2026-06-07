import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateContainerUseCase } from '@modules/container/application/use-cases/UpdateContainerUseCase';

export default createController(UpdateContainerUseCase, {
});
