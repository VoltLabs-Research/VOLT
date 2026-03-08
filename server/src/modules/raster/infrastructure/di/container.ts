import { container } from 'tsyringe';
import RasterizerQueue from '@modules/raster/infrastructure/queues/RasterizerQueue';
import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
import { RasterMetadataService } from '@modules/raster/infrastructure/services/RasterMetadataService';
import { RasterFrameService } from '@modules/raster/infrastructure/services/RasterFrameService';
import { RasterJobEnqueuerService } from '@modules/raster/infrastructure/services/RasterJobEnqueuerService';
import { RasterSessionCompletedEventHandler } from '@modules/raster/application/events/RasterSessionCompletedEventHandler';
import { RASTER_TOKENS } from './RasterTokens';

export const registerRasterDependencies = (): void => {
    container.registerSingleton(RASTER_TOKENS.RasterStorage, RasterStorageService);
    container.registerSingleton(RASTER_TOKENS.RasterMetadataReader, RasterMetadataService);
    container.registerSingleton(RASTER_TOKENS.RasterFrameReader, RasterFrameService);
    container.registerSingleton(RASTER_TOKENS.RasterJobEnqueuer, RasterJobEnqueuerService);
    container.registerSingleton(RASTER_TOKENS.RasterSessionCompletedEventHandler, RasterSessionCompletedEventHandler);
    container.registerSingleton(RASTER_TOKENS.RasterizerQueue, RasterizerQueue);
};
