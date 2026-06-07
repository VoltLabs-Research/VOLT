import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { CreateContainerUseCase } from '@modules/container/application/use-cases/CreateContainerUseCase';

export default createController(CreateContainerUseCase, {
    statusCode: HttpStatus.Created,
});
