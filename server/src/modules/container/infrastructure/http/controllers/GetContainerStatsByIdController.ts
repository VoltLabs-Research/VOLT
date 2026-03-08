import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetContainerStatsUseCase } from '@modules/container/application/use-cases/GetContainerStatsUseCase';
import { containerValidation } from '@modules/container/infrastructure/http/validation/container-schemas';

export default createController(GetContainerStatsUseCase, {
    validationSchema: containerValidation.byId
});
