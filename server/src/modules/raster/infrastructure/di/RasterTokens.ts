import { RASTER_CONTRACT_TOKENS } from '@shared/contracts/tokens/RasterTokens';

export const RASTER_TOKENS = Object.freeze({
    RasterFrameReader: Symbol.for('RasterFrameReader'),
    RasterJobEnqueuer: Symbol.for('RasterJobEnqueuer'),
    // Cross-consumed (trajectory): single source of truth is the neutral
    // contract token. Same `Symbol.for(...)` key — runtime-identical.
    RasterStorageService: RASTER_CONTRACT_TOKENS.RasterStorageService,
    GetRasterMetadataUseCase: RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase,
    RasterMetadataService: Symbol.for('RasterMetadataService')
});
