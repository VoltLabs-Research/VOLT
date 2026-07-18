import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { GetColoredModelStreamInputDTO, GetColoredModelStreamOutputDTO } from '@modules/trajectory/dtos/color-coding';
import type { IColorCodingService } from '@modules/trajectory/ports/color-coding/IColorCodingService';
import { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@Singleton()
export class GetColoredModelStreamUseCase implements IUseCase<GetColoredModelStreamInputDTO, StreamableOutput> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(input: GetColoredModelStreamInputDTO): Promise<StreamableOutput> {
        const response = await this.colorCodingService.getModelStreamResponse(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.startValue,
            input.endValue,
            input.gradient,
            input.analysisId,
            input.exposureId
        );

        return response satisfies GetColoredModelStreamOutputDTO & StreamableOutput;
    }
};
