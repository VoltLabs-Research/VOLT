import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetRBACConfigUseCase } from '@modules/system/application/use-cases/GetRBACConfigUseCase';

export default createController(GetRBACConfigUseCase);
