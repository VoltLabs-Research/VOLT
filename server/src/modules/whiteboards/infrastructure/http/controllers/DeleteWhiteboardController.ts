import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteWhiteboardUseCase } from '@modules/whiteboards/application/use-cases/DeleteWhiteboardUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export default createController(DeleteWhiteboardUseCase, {
    statusCode: HttpStatus.NoContent
});
