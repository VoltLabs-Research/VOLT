/**
 * Neutral, cross-module DTO contract for the get-raster-metadata use case.
 *
 * Extracted from `@modules/raster/application/dtos/GetRasterMetadataDTO` during
 * the detachable-modules migration: the trajectory module's public-canvas
 * raster-metadata use case consumes `GetRasterMetadataOutputDTO` (and the
 * `IGetRasterMetadataUseCase` port returns it). Structural, neutral types — the
 * `metadata` payload references the neutral `RasterMetadata` contract type, not
 * the owner entity. The owner DTO file re-exports these so existing importers
 * compile unchanged. Pure type — no `@modules/*` coupling.
 */
import type { RasterMetadata } from '@shared/contracts/types/RasterMetadata';

export interface GetRasterMetadataInputDTO {
    trajectoryId: string;
    teamId: string;
}

export interface GetRasterMetadataOutputDTO {
    metadata: RasterMetadata | null;
}
