import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(DeleteContainerUseCase, {
    statusCode: HttpStatus.NoContent,
    validationSchema: containerValidation.byId,
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
