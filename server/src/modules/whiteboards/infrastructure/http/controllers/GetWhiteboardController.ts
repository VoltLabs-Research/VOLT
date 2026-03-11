import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createController(GetWhiteboardUseCase, {
    validationSchema: whiteboardValidation.getWhiteboard
});
