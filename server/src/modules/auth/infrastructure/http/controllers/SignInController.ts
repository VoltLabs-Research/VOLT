import { createController } from '@shared/infrastructure/http/controllers/createController';
import SignInUseCase from '@modules/auth/application/use-cases/SignInUseCase';

export default createController(SignInUseCase, {
});
