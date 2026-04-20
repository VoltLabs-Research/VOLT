import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetColoredModelStreamInputDTO, GetColoredModelStreamOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable, inject } from 'tsyringe';

import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@injectable()
export class GetColoredModelStreamUseCase implements IUseCase<GetColoredModelStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(input: GetColoredModelStreamInputDTO): Promise<Result<StreamableOutput, ApplicationError>> {
        const stream = await this.colorCodingService.getModelStream(
            input.trajectoryId,
            input.timestep,
            input.property,
            input.startValue,
            input.endValue,
            input.gradient,
            input.analysisId,
            input.exposureId
        );

        return Result.ok({ stream } satisfies GetColoredModelStreamOutputDTO & StreamableOutput);
    }
};
