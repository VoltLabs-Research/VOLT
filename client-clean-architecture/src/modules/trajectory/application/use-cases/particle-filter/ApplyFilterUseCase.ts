import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IParticleFilterRepository from '../../../domain/ports/IParticleFilterRepository';
import type { ApplyFilterInputDTO, ApplyFilterOutputDTO } from '../../dtos/particle-filter';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class ApplyFilterUseCase implements IUseCase<ApplyFilterInputDTO, ApplyFilterOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterRepository)
        private readonly particleFilterRepository: IParticleFilterRepository
    ){}

    async execute(input: ApplyFilterInputDTO): Promise<ApplyFilterOutputDTO>{
        return this.particleFilterRepository.applyAction(input);
    }
};
