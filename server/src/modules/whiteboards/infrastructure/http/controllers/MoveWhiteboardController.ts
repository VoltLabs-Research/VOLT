import { createController } from '@shared/infrastructure/http/controllers/createController';
import { MoveWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/MoveWhiteboardUseCase';

export default createController(MoveWhiteboardUseCase, {
});
