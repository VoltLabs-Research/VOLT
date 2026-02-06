import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';

@injectable()
export class GetColorCodingPropertiesUseCase {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(
        trajectoryId: string,
        timestep: string,
        analysisId?: string
    ): Promise<{ base: string[]; modifiers: Record<string, string[]> }> {
        return this.colorCodingService.getProperties(trajectoryId, timestep, analysisId);
    }
}
