import { createController } from '@shared/infrastructure/http/controllers/createController';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';
import { createSecretKeyInputSchema } from '@modules/team/application/dtos/secret-key/CreateSecretKeyDTO';
import CreateSecretKeyUseCase from '@modules/team/application/use-cases/secret-key/CreateSecretKeyUseCase';

const CreateSecretKeyController = createController(CreateSecretKeyUseCase, {
    statusCode: HttpStatus.Created,
    validationSchema: {
        params: createSecretKeyInputSchema.pick({ teamId: true }),
        body: createSecretKeyInputSchema.pick({ roleId: true, name: true }),
        request: createSecretKeyInputSchema.pick({ userId: true })
    }
});
export default CreateSecretKeyController;
