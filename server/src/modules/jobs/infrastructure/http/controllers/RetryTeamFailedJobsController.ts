import { inject, injectable } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import RetryTeamFailedJobsUseCase from '@modules/jobs/application/use-cases/RetryTeamFailedJobsUseCase';

@injectable()
export default class RetryTeamFailedJobsController extends BaseController<RetryTeamFailedJobsUseCase> {
    constructor(
        @inject(RetryTeamFailedJobsUseCase)
        useCase: RetryTeamFailedJobsUseCase
    ) {
        super(useCase);
    }
}
