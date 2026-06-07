import { createController } from '@shared/infrastructure/http/controllers/createController';
import { TriggerRasterizationUseCase } from '@modules/raster/application/use-cases/TriggerRasterizationUseCase';
import { HttpStatus } from '@shared/infrastructure/http/constants/HttpStatus';

export const TriggerRasterizationController = createController(TriggerRasterizationUseCase, {
    statusCode: HttpStatus.Accepted,
});
