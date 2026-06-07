import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/GetWhiteboardUseCase';

export default createController(GetWhiteboardUseCase, {
});
