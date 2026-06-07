import { createController } from '@shared/infrastructure/http/controllers/createController';
import CheckEmailUseCase from '@modules/auth/application/use-cases/CheckEmailUseCase';

export default createController(CheckEmailUseCase, {
});
