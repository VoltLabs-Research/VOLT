import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetSystemStatsUseCase } from '@modules/system/application/use-cases/GetSystemStatsUseCase';

export default createController(GetSystemStatsUseCase);
