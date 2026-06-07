import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetContainerStatsUseCase } from '@modules/container/application/use-cases/GetContainerStatsUseCase';

export default createController(GetContainerStatsUseCase, {
});
