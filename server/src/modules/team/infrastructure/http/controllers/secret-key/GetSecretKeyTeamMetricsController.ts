import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import GetSecretKeyTeamMetricsUseCase from '@modules/team/application/use-cases/secret-key/GetSecretKeyTeamMetricsUseCase';
import { GetSecretKeyTeamMetricsInputDTO } from '@modules/team/application/dtos/secret-key/GetSecretKeyTeamMetricsDTO';

@injectable()
export default class GetSecretKeyTeamMetricsController extends BaseController<GetSecretKeyTeamMetricsUseCase> {
    constructor(
        @inject(GetSecretKeyTeamMetricsUseCase)
        useCase: GetSecretKeyTeamMetricsUseCase
    ) {
        super(useCase);
    }

    protected override getParams(req: AuthenticatedRequest): GetSecretKeyTeamMetricsInputDTO {
        return {
            teamId: req.params.teamId,
            days: req.query.days ? Number(req.query.days) : undefined
        };
    }
}
