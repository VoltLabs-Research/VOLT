import { createController } from '@shared/infrastructure/http/controllers/createController';
import { GetRasterMetadataUseCase } from '@modules/raster/application/use-cases/GetRasterMetadataUseCase';

export const GetRasterMetadataController = createController(GetRasterMetadataUseCase, {
});
