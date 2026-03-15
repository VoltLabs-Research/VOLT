import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteWhiteboardFolderUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardFolderUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(DeleteWhiteboardFolderUseCase, {
    validationSchema: whiteboardValidation.deleteFolder,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
