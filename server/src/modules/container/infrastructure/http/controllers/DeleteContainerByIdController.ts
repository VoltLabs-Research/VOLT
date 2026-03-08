import { createController } from '@shared/infrastructure/http/controllers/createController';
import { DeleteContainerUseCase } from '@modules/container/application/use-cases/DeleteContainerUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(DeleteContainerUseCase, {
    validationSchema: containerValidation.byId
});
