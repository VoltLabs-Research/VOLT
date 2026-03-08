import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetRasterMetadataUseCase } from '@modules/raster/application/use-cases/GetRasterMetadataUseCase';
import { rasterValidation } from '@modules/raster/infrastructure/http/validation/raster-schemas';

export const GetRasterMetadataController = createController(GetRasterMetadataUseCase, {
    validationSchema: rasterValidation.metadata
});
