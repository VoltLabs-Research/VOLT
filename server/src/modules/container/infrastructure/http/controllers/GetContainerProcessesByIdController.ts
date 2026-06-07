import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetContainerProcessesUseCase } from '@modules/container/application/use-cases/GetContainerProcessesUseCase';

export default createController(GetContainerProcessesUseCase, {
});
