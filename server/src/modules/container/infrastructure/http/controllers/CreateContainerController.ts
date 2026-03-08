import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(CreateContainerUseCase, {
    validationSchema: containerValidation.create
});
