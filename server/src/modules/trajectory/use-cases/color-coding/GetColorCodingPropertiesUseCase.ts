import { TRAJECTORY_TOKENS } from '@modules/trajectory/di/TrajectoryTokens';
import { GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO } from '@modules/trajectory/dtos/color-coding';
import { runTrajectoryService } from '@modules/trajectory/use-cases/shared/run-trajectory-service';
import type { IColorCodingService } from '@modules/trajectory/ports/color-coding/IColorCodingService';
import type { IUseCase } from '@shared/application/IUseCase';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetColorCodingPropertiesUseCase
    implements IUseCase<GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService) private readonly colorCodingService: IColorCodingService
    ) {}

    execute(input: GetColorCodingPropertiesInputDTO): Promise<GetColorCodingPropertiesOutputDTO> {
        return runTrajectoryService(this.colorCodingService, input, (service, dto) =>
            service.getProperties(dto.trajectoryId, dto.timestep, dto.analysisId));
    }
};
