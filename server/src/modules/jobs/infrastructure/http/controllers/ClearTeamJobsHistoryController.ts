import { inject, injectable } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import ClearTeamJobsHistoryUseCase from '@modules/jobs/application/use-cases/ClearTeamJobsHistoryUseCase';

@injectable()
export default class ClearTeamJobsHistoryController extends BaseController<ClearTeamJobsHistoryUseCase> {
    constructor(
        @inject(ClearTeamJobsHistoryUseCase)
        useCase: ClearTeamJobsHistoryUseCase
    ) {
        super(useCase);
    }
}
