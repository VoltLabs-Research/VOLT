import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListWhiteboardFoldersUseCase } from '@modules/whiteboards/application/use-cases/ListWhiteboardFoldersUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createPaginatedController(ListWhiteboardFoldersUseCase, {
    validationSchema: whiteboardValidation.listFolders
});
