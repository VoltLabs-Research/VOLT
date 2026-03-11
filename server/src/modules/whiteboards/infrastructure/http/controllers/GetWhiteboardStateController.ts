import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetWhiteboardStateUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardStateUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createStreamController(GetWhiteboardStateUseCase, {
    validationSchema: whiteboardValidation.getWhiteboardState,
    getHeaders: () => ({
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
    })
});
