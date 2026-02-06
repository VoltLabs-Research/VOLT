import { injectable, inject } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import FindActivityByTeamIdUseCase from '@modules/daily-activity/application/use-cases/FindActivityByTeamIdUseCase';
import { AuthenticatedRequest } from '@shared/infrastructure/http/middleware/authentication';
import { FindActivityByTeamIdInputDTO } from '@modules/daily-activity/application/dto/FindActivityByTeamIdDTO';

@injectable()
export default class FindActivityByTeamIdController extends BaseController<FindActivityByTeamIdUseCase> {
    constructor(
        @inject(FindActivityByTeamIdUseCase) useCase: FindActivityByTeamIdUseCase
    ) {
        super(useCase);
    }

    protected getParams(req: AuthenticatedRequest): FindActivityByTeamIdInputDTO {
        const rangeParam = req.query.range ?? '7';
        const range = parseInt(rangeParam as string);

        return {
            teamId: req.params.teamId as string,
            range
        };
    }
};