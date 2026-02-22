import { inject, injectable } from 'tsyringe';
import { BaseController } from '@shared/infrastructure/http/BaseController';
import RemoveTeamRunningJobsUseCase from '@modules/jobs/application/use-cases/RemoveTeamRunningJobsUseCase';

@injectable()
export default class RemoveTeamRunningJobsController extends BaseController<RemoveTeamRunningJobsUseCase> {
    constructor(
        @inject(RemoveTeamRunningJobsUseCase)
        useCase: RemoveTeamRunningJobsUseCase
    ) {
        super(useCase);
    }
}
