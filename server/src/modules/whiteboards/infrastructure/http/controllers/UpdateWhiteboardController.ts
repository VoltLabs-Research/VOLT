import { createController } from '@shared/infrastructure/http/controllers/createController';
import { UpdateWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/UpdateWhiteboardUseCase';

export default createController(UpdateWhiteboardUseCase);
