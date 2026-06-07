import { createController } from '@shared/infrastructure/http/controllers/createController';
import { SaveWhiteboardStateUseCase } from '@modules/whiteboards/application/use-cases/SaveWhiteboardStateUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(SaveWhiteboardStateUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId,
        stateBuffer: Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body))
    })
});
