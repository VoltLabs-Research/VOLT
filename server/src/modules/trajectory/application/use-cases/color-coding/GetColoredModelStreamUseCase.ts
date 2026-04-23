import { GetColoredModelStreamInputDTO, GetColoredModelStreamOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';


import ColorCodingService from '@modules/trajectory/infrastructure/services/color-coding/ColorCodingService';
import type { StreamableOutput } from '@shared/infrastructure/http/controllers/BaseStreamController';

@Singleton()
export class GetColoredModelStreamUseCase implements IUseCase<GetColoredModelStreamInputDTO, StreamableOutput, ApplicationError> {
    constructor(
        
        private readonly colorCodingService: ColorCodingService
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
