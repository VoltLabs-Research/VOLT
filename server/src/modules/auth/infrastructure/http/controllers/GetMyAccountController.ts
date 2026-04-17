import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetMyAccountUseCase from '@modules/auth/application/use-cases/GetMyAccountUseCase';

export default createController(GetMyAccountUseCase);
