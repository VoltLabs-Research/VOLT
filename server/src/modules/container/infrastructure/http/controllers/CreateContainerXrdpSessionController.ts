import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateContainerXrdpSessionUseCase } from '@modules/container/application/use-cases/CreateContainerXrdpSessionUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(CreateContainerXrdpSessionUseCase, {
    validationSchema: containerValidation.createXrdpSession
});
