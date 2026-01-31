import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryRepository from '../../../domain/ports/ITrajectoryRepository';
import type { CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO } from '../../dtos/trajectory';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class CreateTrajectoryUseCase implements IUseCase<CreateTrajectoryInputDTO, CreateTrajectoryOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ){}

    async execute(input: CreateTrajectoryInputDTO): Promise<CreateTrajectoryOutputDTO>{
        const trajectory = await this.trajectoryRepository.create(input.formData, input.onProgress);
        return trajectory;
    }
};
