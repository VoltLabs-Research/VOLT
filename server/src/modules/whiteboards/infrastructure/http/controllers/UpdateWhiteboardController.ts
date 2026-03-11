import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createController(UpdateWhiteboardUseCase, {
    validationSchema: whiteboardValidation.updateWhiteboard
});
