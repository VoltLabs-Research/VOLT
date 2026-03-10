import { RasterStorageService } from '@modules/raster/infrastructure/services/RasterStorageService';
import { RasterMetadataService } from '@modules/raster/infrastructure/services/RasterMetadataService';
import { RasterFrameService } from '@modules/raster/infrastructure/services/RasterFrameService';
import { RasterJobEnqueuerService } from '@modules/raster/infrastructure/services/RasterJobEnqueuerService';
import { RASTER_TOKENS } from './RasterTokens';
import { registerModuleDependencies } from '@shared/infrastructure/di/registerModuleDependencies';

export const registerRasterDependencies = (): void => {
    registerModuleDependencies({
        singletons: [
            [RASTER_TOKENS.RasterStorage, RasterStorageService],
            [RASTER_TOKENS.RasterMetadataReader, RasterMetadataService],
            [RASTER_TOKENS.RasterFrameReader, RasterFrameService],
            [RASTER_TOKENS.RasterJobEnqueuer, RasterJobEnqueuerService]
        ]
    });
};
