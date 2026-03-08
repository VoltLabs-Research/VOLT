import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';

import { injectable, inject } from 'tsyringe';

@injectable()
export class GetColorCodingPropertiesUseCase extends ValidatedServiceUseCase<
    GetColorCodingPropertiesInputDTO,
    GetColorCodingPropertiesOutputDTO,
    IColorCodingService
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) {
        super(
            colorCodingService,
            () => null,
            (service, input) => service.getProperties(input.trajectoryId, input.timestep, input.analysisId)
        );
    }
};
