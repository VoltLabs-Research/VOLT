import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryRepository from '../../../domain/ports/ITrajectoryRepository';
import type { GetTrajectoriesInputDTO, GetTrajectoriesOutputDTO } from '../../dtos/trajectory';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetTrajectoriesUseCase implements IUseCase<GetTrajectoriesInputDTO, GetTrajectoriesOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ){}

    async execute(params: GetTrajectoriesInputDTO): Promise<GetTrajectoriesOutputDTO>{
        return this.trajectoryRepository.getAll(params);
    }
};
