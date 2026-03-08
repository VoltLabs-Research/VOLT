import { createController } from '@shared/infrastructure/http/controllers/createController';
import { TriggerRasterizationUseCase } from '@modules/raster/application/use-cases/TriggerRasterizationUseCase';
import { rasterValidation } from '@modules/raster/infrastructure/http/validation/raster-schemas';

export const TriggerRasterizationController = createController(TriggerRasterizationUseCase, {
    validationSchema: rasterValidation.trigger
});
