import { RasterSessionCompletedEventHandler } from '@modules/raster/application/events/RasterSessionCompletedEventHandler';
import { RasterStorageService } from '@modules/raster/services/RasterStorageService';
import { RasterMetadataService } from '@modules/raster/services/RasterMetadataService';
import { RasterFrameService } from '@modules/raster/services/RasterFrameService';
import { RasterJobEnqueuerService } from '@modules/raster/services/RasterJobEnqueuerService';
import { RASTER_TOKENS } from './RasterTokens';
import RasterizerQueue from '@modules/raster/queues/RasterizerQueue';
import { container } from 'tsyringe';

export const registerRasterDependencies = (): void => {
    container.registerSingleton(RASTER_TOKENS.RasterStorage, RasterStorageService);
    container.registerSingleton(RASTER_TOKENS.RasterMetadataReader, RasterMetadataService);
    container.registerSingleton(RASTER_TOKENS.RasterFrameReader, RasterFrameService);
    container.registerSingleton(RASTER_TOKENS.RasterJobEnqueuer, RasterJobEnqueuerService);
    container.registerSingleton(RASTER_TOKENS.RasterSessionCompletedEventHandler, RasterSessionCompletedEventHandler);
    container.registerSingleton(RASTER_TOKENS.RasterizerQueue, RasterizerQueue);
};
