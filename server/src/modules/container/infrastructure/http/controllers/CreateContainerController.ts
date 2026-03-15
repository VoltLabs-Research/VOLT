import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(CreateContainerUseCase, {
    statusCode: HttpStatus.Created,
    validationSchema: containerValidation.create,
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
