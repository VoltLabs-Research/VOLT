import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardUseCase';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(UpdateWhiteboardUseCase, {
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
