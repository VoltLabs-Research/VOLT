import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import CreateSecretKeyUseCase from '@modules/team/application/use-cases/secret-key/CreateSecretKeyUseCase';

const CreateSecretKeyController = createController(CreateSecretKeyUseCase, {
    statusCode: HttpStatus.Created,
});
export default CreateSecretKeyController;
