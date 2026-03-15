import { createController } from '@shared/infrastructure/http/controllers/createController';
import { CreateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/CreateWhiteboardUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(CreateWhiteboardUseCase, {
    validationSchema: whiteboardValidation.createWhiteboard,
    statusCode: HttpStatus.Created,
    extendParams: (request, params) => ({
        ...params,
        userId: request.userId
    })
});
