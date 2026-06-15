import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetOAuthProvidersUseCase from '@modules/auth/application/use-cases/GetOAuthProvidersUseCase';

export default createController(GetOAuthProvidersUseCase, {});
