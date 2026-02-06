import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';

@injectable()
export class GetColorCodingStatsUseCase {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(
        trajectoryId: string,
        timestep: string,
        property: string,
        type: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<{ min: number; max: number }> {
        return this.colorCodingService.getStats(
            trajectoryId,
            timestep,
            property,
            type,
            analysisId,
            exposureId
        );
    }
}
