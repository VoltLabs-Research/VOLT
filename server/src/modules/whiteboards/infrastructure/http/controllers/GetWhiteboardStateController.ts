import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetWhiteboardStateUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardStateUseCase';

export default createStreamController(GetWhiteboardStateUseCase, {
    getHeaders: () => ({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    })
});
