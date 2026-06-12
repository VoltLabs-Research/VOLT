/**
 * Re-export shim. The canonical get-plugin-exposure-GLB DTOs now live in the
 * neutral `@shared/contracts/dtos/GetPluginExposureGLBDTO` (detachable-modules
 * migration). Existing
 * `@modules/plugin/application/dtos/exposure/GetPluginExposureGLBDTO` importers
 * keep working unchanged.
 */
export type {
    GetPluginExposureGLBInputDTO,
    GetPluginExposureGLBOutputDTO
} from '@shared/contracts/dtos/GetPluginExposureGLBDTO';
