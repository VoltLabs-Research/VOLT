import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/CreateWhiteboardFolderUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateWhiteboardFolderUseCase, {
    validationSchema: whiteboardValidation.createFolder,
    extendParams: (req, params) => ({
        ...params,
        userId: req.userId
    }),
    statusCode: HttpStatus.Created
});
