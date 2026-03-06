import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryRepository from '../../../domain/port/ITrajectoryRepository';
import type { DeleteTrajectoryInputDTO } from '../../dtos/trajectory';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class DeleteTrajectoryUseCase implements IUseCase<DeleteTrajectoryInputDTO, void>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ){}

    async execute(input: DeleteTrajectoryInputDTO): Promise<void>{
        await this.trajectoryRepository.delete(input.id);
        this.trajectoryRepository.invalidatePreviewCache(input.id);
    }
};
