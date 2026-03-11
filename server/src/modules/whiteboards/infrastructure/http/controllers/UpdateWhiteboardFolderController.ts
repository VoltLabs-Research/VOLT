import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardFolderUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createController(UpdateWhiteboardFolderUseCase, {
    validationSchema: whiteboardValidation.updateFolder
});
