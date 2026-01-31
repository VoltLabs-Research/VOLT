import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryRepository from '../../../domain/ports/ITrajectoryRepository';
import type { Trajectory } from '../../../domain/entities';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetTrajectoryByIdUseCase implements IUseCase<string, Trajectory>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ){}

    async execute(id: string): Promise<Trajectory>{
        return this.trajectoryRepository.getById(id);
    }
};
