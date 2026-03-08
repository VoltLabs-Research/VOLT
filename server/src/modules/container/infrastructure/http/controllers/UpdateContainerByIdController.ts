import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateContainerUseCase } from '@modules/container/application/use-cases/UpdateContainerUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(UpdateContainerUseCase, {
    validationSchema: containerValidation.update
});
