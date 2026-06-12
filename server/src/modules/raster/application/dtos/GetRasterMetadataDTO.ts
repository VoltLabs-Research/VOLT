/**
 * Re-export shim. The canonical get-raster-metadata DTOs now live in the
 * neutral `@shared/contracts/dtos/GetRasterMetadataDTO` (detachable-modules
 * migration). Existing `@modules/raster/application/dtos/GetRasterMetadataDTO`
 * importers keep working unchanged.
 */
export type {
    GetRasterMetadataInputDTO,
    GetRasterMetadataOutputDTO
} from '@shared/contracts/dtos/GetRasterMetadataDTO';
