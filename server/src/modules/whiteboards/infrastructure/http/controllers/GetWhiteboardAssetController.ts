import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetWhiteboardAssetUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardAssetUseCase';
import type { GetWhiteboardAssetOutputDTO } from '@modules/whiteboards/application/dtos/GetWhiteboardAssetDTO';

export default createStreamController(GetWhiteboardAssetUseCase, {
    getHeaders: (result: GetWhiteboardAssetOutputDTO) => ({
        'Content-Type': result.mimetype || 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000'
    })
});
