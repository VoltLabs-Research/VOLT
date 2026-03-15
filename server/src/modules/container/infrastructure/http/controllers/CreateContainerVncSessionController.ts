import { CreateContainerVncSessionUseCase } from '@modules/container/application/use-cases/CreateContainerVncSessionUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateContainerVncSessionUseCase, {
    validationSchema: containerValidation.createVncSession,
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
