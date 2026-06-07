import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';

export default createController(GetContainerFilesUseCase, {
});
