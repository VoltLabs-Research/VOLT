import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetContainerProcessesUseCase } from '@modules/container/application/use-cases/GetContainerProcessesUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(GetContainerProcessesUseCase, {
    validationSchema: containerValidation.byId
});
