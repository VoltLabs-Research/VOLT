import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO } from '@modules/trajectory/application/dtos/generated-models';

@injectable()
export class GetColorCodingPropertiesUseCase implements IUseCase<GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) { }

    async execute(input: GetColorCodingPropertiesInputDTO): Promise<Result<GetColorCodingPropertiesOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep } = input;
        const hasMissingRequired = [trajectoryId, timestep].some((value) => !value?.trim());

        if (hasMissingRequired) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.COLOR_CODING_MISSING_PARAMS,
                'Missing required color-coding parameters'
            ));
        }

        const data = await this.colorCodingService.getProperties(trajectoryId, timestep, input.analysisId);
        return Result.ok(data);
    }
}
