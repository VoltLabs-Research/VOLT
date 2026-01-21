import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';

@injectable()
export class GetParticleFilterPropertiesUseCase {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(
        trajectoryId: string,
        timestep: string,
        analysisId?: string
    ): Promise<{ dump: string[]; perAtom: Record<string, string[]> }> {
        return this.particleFilterService.getProperties(trajectoryId, timestep, analysisId);
    }
}
