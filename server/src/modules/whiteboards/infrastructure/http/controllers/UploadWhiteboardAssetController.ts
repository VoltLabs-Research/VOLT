import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UploadWhiteboardAssetUseCase } from '@modules/whiteboards/application/use-cases/UploadWhiteboardAssetUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import type { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';

export default createController(UploadWhiteboardAssetUseCase, {
    validationSchema: whiteboardValidation.uploadWhiteboardAsset,
    statusCode: HttpStatus.Created,
    extendParams: (req: AuthenticatedRequest, params: Record<string, unknown>) => ({
        ...params,
        buffer: req.file?.buffer ?? Buffer.alloc(0),
        mimetype: req.file?.mimetype ?? 'application/octet-stream',
        originalname: req.file?.originalname ?? 'asset'
    })
});
