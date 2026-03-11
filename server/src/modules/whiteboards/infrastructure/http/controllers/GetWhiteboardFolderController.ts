import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardFolderUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createController(GetWhiteboardFolderUseCase, {
    validationSchema: whiteboardValidation.getFolder
});
