import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardFolderUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createController(DeleteWhiteboardFolderUseCase, {
    validationSchema: whiteboardValidation.deleteFolder
});
