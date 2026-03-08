import { createStreamController } from '@shared/infrastructure/http/controllers/createController';
import { GetRasterFramePNGUseCase } from '@modules/raster/application/use-cases/GetRasterFramePNGUseCase';
import { rasterValidation } from '@modules/raster/infrastructure/http/validation/raster-schemas';

export const GetRasterFramePNGController = createStreamController(GetRasterFramePNGUseCase, {
    validationSchema: rasterValidation.frame,
    getHeaders: (resultValue) => resultValue.headers,
    prepareOutput: async (resultValue) => {
        await resultValue.prepare?.();
    }
});
