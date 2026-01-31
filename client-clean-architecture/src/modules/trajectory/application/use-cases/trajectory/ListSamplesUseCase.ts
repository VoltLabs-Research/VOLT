import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type ITrajectoryRepository from '../../../domain/ports/ITrajectoryRepository';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class ListSamplesUseCase implements IUseCase<void, string[]>{
    constructor(
        @inject(TRAJECTORY_TOKENS.TrajectoryRepository)
        private readonly trajectoryRepository: ITrajectoryRepository
    ){}

    async execute(): Promise<string[]>{
        return this.trajectoryRepository.listSamples();
    }
};
