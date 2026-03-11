import { UpdateContainerFolderUseCase } from '@modules/container/application/use-cases/UpdateContainerFolderUseCase';
import { createController } from '@shared/infrastructure/http/controllers/createController';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(UpdateContainerFolderUseCase, {
    validationSchema: containerValidation.updateFolder
});
