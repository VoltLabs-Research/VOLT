import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetRasterFramePNGUseCase } from '@modules/raster/application/use-cases/GetRasterFramePNGUseCase';
import { rasterValidation } from '@modules/raster/infrastructure/http/validation/raster-schemas';

export const GetRasterFramePNGController = createPreparedDownloadStreamController(GetRasterFramePNGUseCase, {
    validationSchema: rasterValidation.frame
});
