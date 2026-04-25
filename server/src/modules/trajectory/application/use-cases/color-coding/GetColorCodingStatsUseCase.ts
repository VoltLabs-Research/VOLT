import { GetColorCodingStatsInputDTO, GetColorCodingStatsOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ColorCodingService from '@modules/trajectory/infrastructure/services/color-coding/ColorCodingService';

@Singleton()
export class GetColorCodingStatsUseCase extends ValidatedServiceUseCase<
    GetColorCodingStatsInputDTO,
    GetColorCodingStatsOutputDTO,
    IColorCodingService
> {
    constructor(
        
        colorCodingService: ColorCodingService
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
};
