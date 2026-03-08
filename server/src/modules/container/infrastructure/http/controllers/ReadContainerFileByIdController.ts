import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ReadContainerFileUseCase } from '@modules/container/application/use-cases/ReadContainerFileUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(ReadContainerFileUseCase, {
    validationSchema: containerValidation.readFile
});
