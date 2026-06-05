import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetColoredModelStreamInputDTO, GetColoredModelStreamOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import type { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@Singleton()
export class GetColoredModelStreamUseCase implements IUseCase<GetColoredModelStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(input: GetColoredModelStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
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

        return Result.ok(response satisfies GetColoredModelStreamOutputDTO & StreamableOutput);
    }
};
