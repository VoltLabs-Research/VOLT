import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@/src/shared/application/IUseCase';
import { Result } from '@/src/shared/domain/ports/Result';
import { GetJobStatusInputDTO, GetJobStatusOutputDTO } from '../../dtos/jobs/JobsDTOs';
import { JOBS_TOKENS } from '@/src/modules/jobs/infrastructure/di/JobsTokens';
import { IJobHandlerService } from '@/src/modules/jobs/domain/ports/IJobHandlerService';

@injectable()
export class GetJobStatusUseCase implements IUseCase<GetJobStatusInputDTO, GetJobStatusOutputDTO> {
    constructor(
        @inject(JOBS_TOKENS.JobHandlerService) private jobService: IJobHandlerService
    ) { }

    async execute(input: GetJobStatusInputDTO): Promise<Result<GetJobStatusOutputDTO>> {
        const job = await this.jobService.getJobStatus(input.jobId);
        return Result.ok({ job });
    }
}
