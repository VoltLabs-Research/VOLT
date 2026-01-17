import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { CancelJobInputDTO, CancelJobOutputDTO } from '../../dtos/jobs/JobsDTOs';
import { JOBS_TOKENS } from '@/src/modules/jobs/infrastructure/di/JobsTokens';
import { IJobHandlerService } from '@/src/modules/jobs/domain/ports/IJobHandlerService';

@injectable()
export class CancelTrajectoryJobUseCase implements IUseCase<CancelJobInputDTO, CancelJobOutputDTO> {
    constructor(
        @inject(JOBS_TOKENS.JobHandlerService) private jobService: IJobHandlerService
    ) { }

    async execute(input: CancelJobInputDTO): Promise<Result<CancelJobOutputDTO>> {
        await this.jobService.cancelJob(input.trajectoryId, input.jobId);

        return Result.ok({
            message: 'Job cancelled successfully',
            jobId: input.jobId
        });
    }
}
