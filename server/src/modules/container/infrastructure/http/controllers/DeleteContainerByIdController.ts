import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';

export default createController(DeleteContainerUseCase, {
    statusCode: HttpStatus.NoContent,
});
