import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetWhiteboardAssetUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardAssetUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';
import type { GetWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardAssetDTO';

export default createStreamController(GetWhiteboardAssetUseCase, {
    validationSchema: whiteboardValidation.getWhiteboardAsset,
    getHeaders: (result: GetWhiteboardAssetOutputDTO) => ({
        'Content-Type': result.mimetype || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000'
    })
});
