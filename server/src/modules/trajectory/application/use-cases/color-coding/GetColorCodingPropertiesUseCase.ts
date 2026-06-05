import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import type { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetColorCodingPropertiesUseCase extends ValidatedServiceUseCase<
    GetColorCodingPropertiesInputDTO,
    GetColorCodingPropertiesOutputDTO,
    IColorCodingService
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        @inject(TRAJECTORY_TOKENS.ColorCodingService) colorCodingService: IColorCodingService
    ) {
        super(
            colorCodingService,
            () => null,
            (service, input) => service.getProperties(input.trajectoryId, input.timestep, input.analysisId)
        );
    }
};
