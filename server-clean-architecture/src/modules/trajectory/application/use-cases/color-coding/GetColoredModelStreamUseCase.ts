import { injectable, inject } from 'tsyringe';
import { Readable } from 'node:stream';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';

@injectable()
export class GetColoredModelStreamUseCase {
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
    ): Promise<Readable> {
        return this.colorCodingService.getModelStream(
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
