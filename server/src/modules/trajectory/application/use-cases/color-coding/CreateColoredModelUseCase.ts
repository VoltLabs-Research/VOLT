import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';

@injectable()
export class CreateColoredModelUseCase {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(
        trajectoryId: string,
        timestep: string,
        property: string,
        startValue: number,
        endValue: number,
        gradient: string,
        analysisId?: string,
        exposureId?: string
    ): Promise<string> {
        return this.colorCodingService.createColoredModel(
            trajectoryId,
            timestep,
            property,
            startValue,
            endValue,
            gradient,
            analysisId,
            exposureId
        );
    }
}
