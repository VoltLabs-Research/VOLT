import { createController } from '@shared/infrastructure/http/controllers/createController';
import GetCurrentSecretKeyUseCase from '@modules/team/application/use-cases/secret-key/GetCurrentSecretKeyUseCase';

export default createController(GetCurrentSecretKeyUseCase, {
    extendParams: (request, params) => ({
        ...params,
        authType: request.authType,
        secretKeyId: request.secretKeyId
    })
});
