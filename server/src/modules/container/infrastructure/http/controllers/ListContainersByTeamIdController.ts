import { createPaginatedController } from '@shared/infrastructure/http/controllers/createController';
import { ListContainersUseCase } from '@modules/container/application/use-cases/ListContainersUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createPaginatedController(ListContainersUseCase, {
    validationSchema: containerValidation.list
});
