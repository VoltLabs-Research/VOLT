import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UploadWhiteboardAssetUseCase } from '@modules/whiteboards/application/use-cases/UploadWhiteboardAssetUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(UploadWhiteboardAssetUseCase, {
    statusCode: HttpStatus.Created,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        userId: req.userId
    })
});
