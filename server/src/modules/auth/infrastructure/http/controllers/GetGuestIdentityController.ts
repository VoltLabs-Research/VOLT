import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetGuestIdentityUseCase from '@modules/auth/application/use-cases/GetGuestIdentityUseCase';

export default createController(GetGuestIdentityUseCase, {
});
