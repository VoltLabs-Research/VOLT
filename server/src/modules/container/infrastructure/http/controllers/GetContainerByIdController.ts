import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetContainerByIdUseCase } from '@modules/container/application/use-cases/GetContainerByIdUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(GetContainerByIdUseCase, {
    validationSchema: containerValidation.byId
});
