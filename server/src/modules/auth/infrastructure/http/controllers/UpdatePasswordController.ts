import { createController } from '@shared/infrastructure/http/controllers/createController';
import UpdatePasswordUseCase from '@modules/auth/application/use-cases/UpdatePasswordUseCase';

export default createController(UpdatePasswordUseCase, {
});
