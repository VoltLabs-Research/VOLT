import { ErrorCodes } from '@core/constants/error-codes';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { CreateColoredModelInputDTO, CreateColoredModelOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';

import { injectable, inject } from 'tsyringe';

@injectable()
export class CreateColoredModelUseCase implements IUseCase<CreateColoredModelInputDTO, CreateColoredModelOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(input: CreateColoredModelInputDTO): Promise<Result<CreateColoredModelOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep, property, gradient } = input;

        await this.colorCodingService.createColoredModel(
            trajectoryId,
            timestep,
            property,
            input.startValue,
            input.endValue,
            gradient,
            input.analysisId,
            input.exposureId
        );

        return Result.ok(null);
    }
};
