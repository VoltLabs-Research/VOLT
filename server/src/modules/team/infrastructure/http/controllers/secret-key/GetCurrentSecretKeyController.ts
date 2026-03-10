import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetCurrentSecretKeyUseCase from '@modules/team/application/use-cases/secret-key/GetCurrentSecretKeyUseCase';

export default createController(GetCurrentSecretKeyUseCase, {
    contextProviders: [
        (request) => ({
            authType: request.authType,
            secretKeyId: request.secretKeyId
        })
    ]
});
