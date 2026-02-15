import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { CreateColoredModelInputDTO, CreateColoredModelOutputDTO } from '@modules/trajectory/application/dtos/generated-models';

@injectable()
export class CreateColoredModelUseCase implements IUseCase<CreateColoredModelInputDTO, CreateColoredModelOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(input: CreateColoredModelInputDTO): Promise<Result<CreateColoredModelOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep, property, gradient } = input;
        const startValue = Number(input.startValue);
        const endValue = Number(input.endValue);
        const hasMissingRequired = [trajectoryId, timestep, property, gradient].some((value) => !value?.trim());

        if (hasMissingRequired || !Number.isFinite(startValue) || !Number.isFinite(endValue)) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                'Missing required color-coding parameters'
            ));
        }

        await this.colorCodingService.createColoredModel(
            trajectoryId,
            timestep,
            property,
            startValue,
            endValue,
            gradient,
            input.analysisId,
            input.exposureId
        );

        return Result.ok(null);
    }
}
