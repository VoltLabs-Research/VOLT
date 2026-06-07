import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(DeleteWhiteboardUseCase, {
    statusCode: HttpStatus.NoContent,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
