import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { GetColorCodingStatsInputDTO, GetColorCodingStatsOutputDTO } from '@modules/trajectory/dtos/color-coding';
import { runTrajectoryService } from '@modules/trajectory/use-cases/shared/run-trajectory-service';
import type { IColorCodingService } from '@modules/trajectory/ports/color-coding/IColorCodingService';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetColorCodingStatsUseCase
    implements IUseCase<GetColorCodingStatsInputDTO, GetColorCodingStatsOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService) private readonly colorCodingService: IColorCodingService
    ) {}

    execute(input: GetColorCodingStatsInputDTO): Promise<GetColorCodingStatsOutputDTO> {
        return runTrajectoryService(this.colorCodingService, input, (service, dto) => service.getStats(
            dto.trajectoryId,
            dto.timestep,
            dto.property,
            dto.type,
            dto.analysisId,
            dto.exposureId
        ));
    }
};
