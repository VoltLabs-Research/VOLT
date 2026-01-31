import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryJobsRepository from '../../../domain/ports/ITrajectoryJobsRepository';
import type { RetryFailedJobsInputDTO, RetryFailedJobsOutputDTO } from '../../dtos/jobs';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class RetryFailedJobsUseCase implements IUseCase<RetryFailedJobsInputDTO, RetryFailedJobsOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryJobsRepository)
        private readonly jobsRepository: ITrajectoryJobsRepository
    ){}

    async execute(input: RetryFailedJobsInputDTO): Promise<RetryFailedJobsOutputDTO>{
        return this.jobsRepository.retryFailedJobs(input.trajectoryId);
    }
};
