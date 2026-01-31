import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryRepository from '../../../domain/ports/ITrajectoryRepository';
import type { UpdateTrajectoryInputDTO, UpdateTrajectoryOutputDTO } from '../../dtos/trajectory';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class UpdateTrajectoryUseCase implements IUseCase<UpdateTrajectoryInputDTO, UpdateTrajectoryOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ){}

    async execute(input: UpdateTrajectoryInputDTO): Promise<UpdateTrajectoryOutputDTO>{
        return this.trajectoryRepository.update(input.id, input.data);
    }
};
