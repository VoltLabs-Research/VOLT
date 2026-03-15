import { createController } from '@shared/infrastructure/http/controllers/createController';
import { TriggerRasterizationUseCase } from '@modules/raster/application/use-cases/TriggerRasterizationUseCase';
import { rasterValidation } from '@modules/raster/infrastructure/http/validation/raster-schemas';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export const TriggerRasterizationController = createController(TriggerRasterizationUseCase, {
    statusCode: HttpStatus.Accepted,
    validationSchema: rasterValidation.trigger
});
