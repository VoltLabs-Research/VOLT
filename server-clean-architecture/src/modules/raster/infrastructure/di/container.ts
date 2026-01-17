import { container } from 'tsyringe';
import { RasterService } from '../services/RasterService';
import RasterizerQueue from '../queues/RasterizerQueue';
import { RASTER_TOKENS } from './RasterTokens';

export const registerRasterDependencies = (): void => {
    container.registerSingleton(RASTER_TOKENS.RasterService, RasterService);
    container.registerSingleton(RASTER_TOKENS.RasterizerQueue, RasterizerQueue);
};
