import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteWhiteboardUseCase, {
    validationSchema: whiteboardValidation.deleteWhiteboard,
    statusCode: HttpStatus.NoContent
});
