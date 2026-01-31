import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IParticleFilterRepository from '../../../domain/ports/IParticleFilterRepository';
import type { GetFilteredGlbInputDTO } from '../../dtos/particle-filter';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetFilteredGlbUseCase implements IUseCase<GetFilteredGlbInputDTO, Blob>{
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterRepository)
        private readonly particleFilterRepository: IParticleFilterRepository
    ){}

    async execute(input: GetFilteredGlbInputDTO): Promise<Blob>{
        return this.particleFilterRepository.getFilteredGlb(input);
    }
};
