/**
 * Neutral, cross-module DI token symbols for the RASTER module.
 *
 * Part of the `shared/contracts` layer (detachable-modules migration): these
 * symbols are injected by more than one module (the trajectory module injects
 * the raster storage service + get-metadata use case for public-canvas raster
 * endpoints), so hosting them here lets a consumer inject without importing the
 * owner module's `RasterTokens.ts`. Keys are the SAME `Symbol.for(...)` strings
 * used by the raster module, so registration and resolution are byte-identical
 * at runtime. The owner `RasterTokens.ts` references these so there is a single
 * source of truth.
 */
export const RASTER_CONTRACT_TOKENS = Object.freeze({
    RasterStorageService: Symbol.for('RasterStorageService'),
    GetRasterMetadataUseCase: Symbol.for('GetRasterMetadataUseCase')
});
