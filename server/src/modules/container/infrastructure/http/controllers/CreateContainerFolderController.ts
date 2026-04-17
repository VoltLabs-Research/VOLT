import { CreateContainerFolderUseCase } from '@modules/container/application/use-cases/CreateContainerFolderUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(CreateContainerFolderUseCase, {
    statusCode: HttpStatus.Created,
    validationSchema: containerValidation.createFolder
});
