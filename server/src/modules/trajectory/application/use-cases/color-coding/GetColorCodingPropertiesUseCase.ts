import { GetColorCodingPropertiesInputDTO, GetColorCodingPropertiesOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import { ValidatedServiceUseCase } from '@modules/trajectory/application/use-cases/shared/ValidatedServiceUseCase';
import { IColorCodingService } from '@modules/trajectory/domain/port/color-coding/IColorCodingService';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ColorCodingService from '@modules/trajectory/infrastructure/services/color-coding/ColorCodingService';

@Singleton()
export class GetColorCodingPropertiesUseCase extends ValidatedServiceUseCase<
    GetColorCodingPropertiesInputDTO,
    GetColorCodingPropertiesOutputDTO,
    IColorCodingService
> {
    constructor(
        
        colorCodingService: ColorCodingService
    ) {
        super(
            colorCodingService,
            () => null,
            (service, input) => service.getProperties(input.trajectoryId, input.timestep, input.analysisId)
        );
    }
};
