import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(UpdateWhiteboardUseCase, {
    validationSchema: whiteboardValidation.updateWhiteboard,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
