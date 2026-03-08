import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetSystemStatsUseCase } from '@modules/system/application/use-cases';

export default createController(GetSystemStatsUseCase);
