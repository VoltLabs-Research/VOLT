import { createController } from '@shared/infrastructure/http/controllers/createController';
import { MoveWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/MoveWhiteboardUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createController(MoveWhiteboardUseCase, {
    validationSchema: whiteboardValidation.moveWhiteboard
});
