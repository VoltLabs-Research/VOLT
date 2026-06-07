import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdateAccountUseCase from '@modules/auth/application/use-cases/UpdateAccountUseCase';

export default createController(UpdateAccountUseCase, {
});
