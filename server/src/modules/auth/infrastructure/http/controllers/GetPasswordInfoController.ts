import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetPasswordInfoUseCase from '@modules/auth/application/use-cases/GetPasswordInfoUseCase';

export default createController(GetPasswordInfoUseCase);
