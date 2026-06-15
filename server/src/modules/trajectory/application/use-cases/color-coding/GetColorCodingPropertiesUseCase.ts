import { TRAJECTORY_TOKENS } from '@modules/trajectory/infrastructure/di/TrajectoryTokens';
import { GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import { runTrajectoryService } from '@modules/trajectory/application/use-cases/shared/run-trajectory-service';
import type { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import type { IUseCase } from '@shared/application/IUseCase';
import type { Result } from '@shared/domain/port/Result';
import type ApplicationError from '@shared/application/errors/ApplicationError';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { inject } from 'tsyringe';

@Singleton()
export class GetColorCodingPropertiesUseCase
    implements IUseCase<GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO, ApplicationError> {
    constructor(
        @inject(TRAJECTORY_TOKENS.ColorCodingService) private readonly colorCodingService: IColorCodingService
    ) {}

    execute(input: GetColorCodingPropertiesInputDTO): Promise<Result<GetColorCodingPropertiesOutputDTO, ApplicationError>> {
        return runTrajectoryService(this.colorCodingService, input, (service, dto) =>
            service.getProperties(dto.trajectoryId, dto.timestep, dto.analysisId));
    }
};
