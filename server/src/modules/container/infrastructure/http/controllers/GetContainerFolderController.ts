import { GetContainerFolderUseCase } from '@modules/container/application/use-cases/GetContainerFolderUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(GetContainerFolderUseCase, {
    validationSchema: containerValidation.getFolder
});
