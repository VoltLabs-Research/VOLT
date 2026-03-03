import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import GetSecretKeyUsageUseCase from '@modules/team/application/use-cases/secret-key/GetSecretKeyUsageUseCase';
import { GetSecretKeyUsageInputDTO } from '@modules/team/application/dtos/secret-key/GetSecretKeyUsageDTO';

@injectable()
export default class GetSecretKeyUsageController extends BaseController<GetSecretKeyUsageUseCase> {
    constructor(
        @inject(GetSecretKeyUsageUseCase)
        useCase: GetSecretKeyUsageUseCase
    ) {
        super(useCase);
    }

    protected override getParams(req: AuthenticatedRequest): GetSecretKeyUsageInputDTO {
        return {
            teamId: req.params.teamId,
            secretKeyId: req.params.secretKeyId,
            days: req.query.days ? Number(req.query.days) : undefined
        };
    }
}
