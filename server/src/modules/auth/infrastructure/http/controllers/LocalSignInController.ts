import { createController } from '@shared/infrastructure/http/controllers/createController';
import LocalSignInUseCase from '@modules/auth/application/use-cases/LocalSignInUseCase';

export default createController(LocalSignInUseCase, {
});
