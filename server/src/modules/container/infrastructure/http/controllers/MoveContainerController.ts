import { MoveContainerUseCase } from '@modules/container/application/use-cases/MoveContainerUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(MoveContainerUseCase, {
    validationSchema: containerValidation.move
});
