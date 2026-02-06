import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { FilterExpression } from '@modules/trajectory/domain/port/IAtomPropertiesService';

@injectable()
export class PreviewParticleFilterUseCase {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(
        trajectoryId: string,
        timestep: string,
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ matchCount: number; totalAtoms: number }> {
        return this.particleFilterService.preview(
            trajectoryId,
            timestep,
            expression,
            analysisId,
            exposureId
        );
    }
}
