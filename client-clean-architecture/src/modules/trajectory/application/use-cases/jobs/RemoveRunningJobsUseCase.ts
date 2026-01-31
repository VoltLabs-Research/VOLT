import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryJobsRepository from '../../../domain/ports/ITrajectoryJobsRepository';
import type { RemoveRunningJobsInputDTO, RemoveRunningJobsOutputDTO } from '../../dtos/jobs';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class RemoveRunningJobsUseCase implements IUseCase<RemoveRunningJobsInputDTO, RemoveRunningJobsOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryJobsRepository)
        private readonly jobsRepository: ITrajectoryJobsRepository
    ){}

    async execute(input: RemoveRunningJobsInputDTO): Promise<RemoveRunningJobsOutputDTO>{
        return this.jobsRepository.removeRunningJobs(input.trajectoryId);
    }
};
