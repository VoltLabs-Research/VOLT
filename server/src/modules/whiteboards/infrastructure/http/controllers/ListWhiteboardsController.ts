import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListWhiteboardsUseCase } from '@modules/whiteboards/application/use-cases/ListWhiteboardsUseCase';
import { whiteboardValidation } from '@modules/whiteboards/infrastructure/http/validation/whiteboard-schemas';

export default createPaginatedController(ListWhiteboardsUseCase, {
    validationSchema: whiteboardValidation.listWhiteboards
});
