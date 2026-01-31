import { inject, injectable } from 'tsyringe';
import type IUseCase from '@/shared/application/use-cases/IUseCase';
import type IParticleFilterRepository from '../../../domain/ports/IParticleFilterRepository';
import type { GetFilterPropertiesInputDTO, GetFilterPropertiesOutputDTO } from '../../dtos/particle-filter';
import { TRAJECTORY_TOKENS } from '../../../infrastructure/di/tokens';

@injectable()
export default class GetFilterPropertiesUseCase implements IUseCase<GetFilterPropertiesInputDTO, GetFilterPropertiesOutputDTO>{
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterRepository)
        private readonly particleFilterRepository: IParticleFilterRepository
    ){}

    async execute(input: GetFilterPropertiesInputDTO): Promise<GetFilterPropertiesOutputDTO>{
        return this.particleFilterRepository.getProperties(input);
    }
};
