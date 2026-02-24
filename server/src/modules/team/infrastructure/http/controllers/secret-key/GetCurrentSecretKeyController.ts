import { inject, injectable } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import GetCurrentSecretKeyUseCase from '@modules/team/application/use-cases/secret-key/GetCurrentSecretKeyUseCase';
import type { GetCurrentSecretKeyInputDTO } from '@modules/team/application/dtos/secret-key/GetCurrentSecretKeyDTO';

@injectable()
export default class GetCurrentSecretKeyController extends BaseController<GetCurrentSecretKeyUseCase> {
    constructor(
        @inject(GetCurrentSecretKeyUseCase)
        useCase: GetCurrentSecretKeyUseCase
    ) {
        super(useCase);
    }

    protected override getParams(req: AuthenticatedRequest): GetCurrentSecretKeyInputDTO {
        return {
            authType: req.authType,
            secretKeyId: req.secretKeyId
        };
    }
}
