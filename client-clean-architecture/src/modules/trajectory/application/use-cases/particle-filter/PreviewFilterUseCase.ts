import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IParticleFilterRepository from '../../../domain/ports/IParticleFilterRepository';
import type { PreviewFilterInputDTO, PreviewFilterOutputDTO } from '../../dtos/particle-filter';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class PreviewFilterUseCase implements IUseCase<PreviewFilterInputDTO, PreviewFilterOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterRepository)
        private readonly particleFilterRepository: IParticleFilterRepository
    ){}

    async execute(input: PreviewFilterInputDTO): Promise<PreviewFilterOutputDTO>{
        return this.particleFilterRepository.preview(input);
    }
};
