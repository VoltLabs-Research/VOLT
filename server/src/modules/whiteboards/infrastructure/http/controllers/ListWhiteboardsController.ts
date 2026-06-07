import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListWhiteboardsUseCase } from '@modules/whiteboards/application/use-cases/ListWhiteboardsUseCase';

export default createPaginatedController(ListWhiteboardsUseCase, {
});
