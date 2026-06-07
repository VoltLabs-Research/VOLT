import { MoveContainerUseCase } from '@modules/container/application/use-cases/MoveContainerUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(MoveContainerUseCase, {
});
