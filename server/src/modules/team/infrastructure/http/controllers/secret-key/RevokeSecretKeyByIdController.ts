import { createController } from '@shared/infrastructure/http/controllers/createController';
import RevokeSecretKeyByIdUseCase from '@modules/team/application/use-cases/secret-key/RevokeSecretKeyByIdUseCase';

const RevokeSecretKeyByIdController = createController(RevokeSecretKeyByIdUseCase);
export default RevokeSecretKeyByIdController;
