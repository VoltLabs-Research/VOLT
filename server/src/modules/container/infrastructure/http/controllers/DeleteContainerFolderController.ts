import { DeleteContainerFolderUseCase } from '@modules/container/application/use-cases/DeleteContainerFolderUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(DeleteContainerFolderUseCase, {
    statusCode: HttpStatus.NoContent,
    validationSchema: containerValidation.deleteFolder,
    contextProviders: [
        (request) => ({
            userId: request.userId ?? ''
        })
    ]
});
