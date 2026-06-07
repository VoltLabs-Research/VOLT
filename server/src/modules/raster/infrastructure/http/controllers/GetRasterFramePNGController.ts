import { createPreparedDownloadStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetRasterFramePNGUseCase } from '@modules/raster/application/use-cases/GetRasterFramePNGUseCase';

export const GetRasterFramePNGController = createPreparedDownloadStreamController(GetRasterFramePNGUseCase, {
});
