import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';
import { FilterExpression } from '@modules/trajectory/domain/port/IAtomPropertiesService';

@injectable()
export class ApplyParticleFilterActionUseCase {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(
        trajectoryId: string,
        timestep: string,
        action: 'delete' | 'highlight',
        expression: FilterExpression,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ fileId: string; atomsResult: number; action: string }> {
        return this.particleFilterService.applyAction(
            trajectoryId,
            timestep,
            action,
            expression,
            analysisId,
            exposureId
        );
    }
}
