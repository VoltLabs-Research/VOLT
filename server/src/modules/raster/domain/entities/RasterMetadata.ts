/**
 * Re-export shim. The canonical raster-metadata types + status enum now live in
 * the neutral `@shared/contracts/types/RasterMetadata` (detachable-modules
 * migration). Existing `@modules/raster/domain/entities/RasterMetadata`
 * importers (including the `RasterMetadataStatus` runtime enum used in
 * comparisons) keep working unchanged.
 */
export type {
    RasterFrameMetadata,
    RasterTrajectoryMetadata,
    RasterAnalysisMetadata,
    RasterMetadata
} from '@shared/contracts/types/RasterMetadata';
export { RasterMetadataStatus } from '@shared/contracts/types/RasterMetadata';
