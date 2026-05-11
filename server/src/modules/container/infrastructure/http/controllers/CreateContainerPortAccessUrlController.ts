import { CreateContainerPortAccessUrlUseCase } from '@modules/container/application/use-cases/CreateContainerPortAccessUrlUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateContainerPortAccessUrlUseCase, {
    validationSchema: containerValidation.createPortAccessUrl
});
