import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryJobsRepository from '../../../domain/ports/ITrajectoryJobsRepository';
import type { ClearHistoryInputDTO, ClearHistoryOutputDTO } from '../../dtos/jobs';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class ClearHistoryUseCase implements IUseCase<ClearHistoryInputDTO, ClearHistoryOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryJobsRepository)
        private readonly jobsRepository: ITrajectoryJobsRepository
    ){}

    async execute(input: ClearHistoryInputDTO): Promise<ClearHistoryOutputDTO>{
        return this.jobsRepository.clearHistory(input.trajectoryId);
    }
};
