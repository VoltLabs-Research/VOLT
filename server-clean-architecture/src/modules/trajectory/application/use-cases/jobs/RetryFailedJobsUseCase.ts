import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { RetryFailedJobsInputDTO, RetryFailedJobsOutputDTO } from '../../dtos/jobs/JobsDTOs';
import { JOBS_TOKENS } from '@/src/modules/jobs/infrastructure/di/JobsTokens';
import { IJobHandlerService } from '@/src/modules/jobs/domain/ports/IJobHandlerService';

@injectable()
export class RetryFailedJobsUseCase implements IUseCase<RetryFailedJobsInputDTO, RetryFailedJobsOutputDTO> {
    constructor(
        @inject(JOBS_TOKENS.JobHandlerService) private jobService: IJobHandlerService
    ) { }

    async execute(input: RetryFailedJobsInputDTO): Promise<Result<RetryFailedJobsOutputDTO>> {
        const retriedCount = await this.jobService.retryFailedJobs(input.trajectoryId);

        return Result.ok({
            message: `Retried ${retriedCount} failed jobs`,
            retriedCount
        });
    }
}
