import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListContainersUseCase } from '@modules/container/application/use-cases/ListContainersUseCase';

export default createPaginatedController(ListContainersUseCase, {
});
