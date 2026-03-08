import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetContainerFilesUseCase } from '@modules/container/application/use-cases/GetContainerFilesUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(GetContainerFilesUseCase, {
    validationSchema: containerValidation.files
});
