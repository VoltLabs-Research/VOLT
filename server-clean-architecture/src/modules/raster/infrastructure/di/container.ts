import { container } from 'tsyringe';
import { RasterService } from '@modules/raster/infrastructure/services/RasterService';
import RasterizerQueue from '@modules/raster/infrastructure/queues/RasterizerQueue';
import { RASTER_TOKENS } from './RasterTokens';

export const registerRasterDependencies = (): void => {
    container.registerSingleton(RASTER_TOKENS.RasterService, RasterService);
    container.registerSingleton(RASTER_TOKENS.RasterizerQueue, RasterizerQueue);
};
