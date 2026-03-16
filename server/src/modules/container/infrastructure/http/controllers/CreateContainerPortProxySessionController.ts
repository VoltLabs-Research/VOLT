import { CreateContainerPortProxySessionUseCase } from '@modules/container/application/use-cases/CreateContainerPortProxySessionUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';
import { createController } from '@shared/infrastructure/http/controllers/createController';

export default createController(CreateContainerPortProxySessionUseCase, {
    validationSchema: containerValidation.createPortProxySession,
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
