import { ListContainerFoldersUseCase } from '@modules/container/application/use-cases/ListContainerFoldersUseCase';
import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createPaginatedController(ListContainerFoldersUseCase, {
    validationSchema: containerValidation.listFolders
});
