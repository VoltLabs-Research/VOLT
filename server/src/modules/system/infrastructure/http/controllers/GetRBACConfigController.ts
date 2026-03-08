import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetRBACConfigUseCase } from '@modules/system/application/use-cases';

export default createController(GetRBACConfigUseCase);
