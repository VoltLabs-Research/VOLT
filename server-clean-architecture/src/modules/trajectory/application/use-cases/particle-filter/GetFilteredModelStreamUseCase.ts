import { injectable, inject } from 'tsyringe';
import { Readable } from 'node:stream';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IParticleFilterService } from '@modules/trajectory/domain/port/IParticleFilterService';

@injectable()
export class GetFilteredModelStreamUseCase {
    constructor(
        @inject(TRAJECTORY_TOKENS.ParticleFilterService)
        private readonly particleFilterService: IParticleFilterService
    ) { }

    async execute(
        trajectoryId: string,
        timestep: string,
        property: string,
        operator: string,
        value: string | number,
        action?: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<Readable> {
        return this.particleFilterService.getModelStream(
            trajectoryId,
            timestep,
            property,
            operator,
            value,
            action,
            analysisId,
            exposureId
        );
    }
}
