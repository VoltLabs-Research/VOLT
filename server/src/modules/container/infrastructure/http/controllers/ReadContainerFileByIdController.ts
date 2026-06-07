import { createController } from '@shared/infrastructure/http/controllers/createController';
import { ReadContainerFileUseCase } from '@modules/container/application/use-cases/ReadContainerFileUseCase';

export default createController(ReadContainerFileUseCase, {
});
