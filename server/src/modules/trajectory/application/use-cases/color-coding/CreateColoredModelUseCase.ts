import { CreateColoredModelInputDTO, CreateColoredModelOutputDTO } from '@modules/trajectory/application/dtos/color-coding';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { Singleton } from '@shared/infrastructure/di/decorators';

import ColorCodingService from '@modules/trajectory/infrastructure/services/color-coding/ColorCodingService';

@Singleton()
export class CreateColoredModelUseCase implements IUseCase<CreateColoredModelInputDTO, CreateColoredModelOutputDTO, ApplicationError> {
    constructor(
        
        private readonly colorCodingService: ColorCodingService
    ) { }

    async execute(input: CreateColoredModelInputDTO): Promise<Result<CreateColoredModelOutputDTO, ApplicationError>> {
        const { trajectoryId, timestep, property, gradient } = input;

        await this.colorCodingService.createColoredModel(
            trajectoryId,
            timestep,
            property,
            input.startValue,
            input.endValue,
            gradient,
            input.analysisId,
            input.exposureId
        );

        return Result.ok(null);
    }
};
