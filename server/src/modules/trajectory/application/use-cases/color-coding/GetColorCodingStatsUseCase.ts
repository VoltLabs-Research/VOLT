import { injectable, inject } from 'tsyringe';
import { TRAJECTORY_TOKENS } from '@modules/trajectory/application/di/TrajectoryTokens';
import { IColorCodingService } from '@modules/trajectory/domain/port/IColorCodingService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { GetColorCodingStatsInputDTO, GetColorCodingStatsOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';

@injectable()
export class GetColorCodingStatsUseCase extends ValidatedServiceUseCase<
    GetColorCodingStatsInputDTO,
    GetColorCodingStatsOutputDTO,
    IColorCodingService
> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService)
        private readonly colorCodingService: IColorCodingService
    ) {
        super(
            colorCodingService,
            () => null,
            (service, input) => service.getStats(
                input.trajectoryId,
                input.timestep,
                input.property,
                input.type,
                input.analysisId,
                input.exposureId
            )
        );
    }
}
