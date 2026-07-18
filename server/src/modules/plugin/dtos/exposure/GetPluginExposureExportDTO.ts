/**
 * Re-export shim. The canonical get-plugin-exposure-export DTOs now live in the
 * neutral `@shared/contracts/dtos/GetPluginExposureExportDTO`
 * (detachable-modules migration). Existing
 * `@modules/plugin/dtos/exposure/GetPluginExposureExportDTO`
 * importers keep working unchanged.
 */
export type {
    GetPluginExposureExportInputDTO,
    GetPluginExposureExportOutputDTO
} from '@shared/contracts/dtos/GetPluginExposureExportDTO';
