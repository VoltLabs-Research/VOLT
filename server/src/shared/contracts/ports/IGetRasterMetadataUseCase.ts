/**
 * Neutral, cross-module port for the get-raster-metadata use case.
 *
 * Extracted during the detachable-modules migration: the trajectory module's
 * `GetPublicCanvasRasterMetadataUseCase` injects the concrete raster
 * `GetRasterMetadataUseCase` only to call `.execute(...)`. Depending on this
 * port (resolved via `RASTER_CONTRACT_TOKENS.GetRasterMetadataUseCase`, same
 * `Symbol.for('GetRasterMetadataUseCase')` key) lets trajectory avoid importing
 * `@modules/raster`. The concrete use case implements this port and is
 * dual-registered (`@Singleton()` + `@AliasOf(token)`) so existing by-class
 * resolution (the raster controller) keeps working unchanged.
 */
import type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@shared/contracts/dtos/GetRasterMetadataDTO';

export interface IGetRasterMetadataUseCase {
    execute(
        input: GetRasterMetadataInputDTO
    ): Promise<GetRasterMetadataOutputDTO>;
}
