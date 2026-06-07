import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetContainerByIdUseCase } from '@modules/container/application/use-cases/GetContainerByIdUseCase';

export default createController(GetContainerByIdUseCase, {
});
