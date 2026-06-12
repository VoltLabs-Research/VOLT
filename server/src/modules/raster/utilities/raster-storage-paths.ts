/**
 * Re-export shim. The canonical raster storage-path helpers now live in the
 * neutral `@shared/application/utilities/raster-storage-paths`
 * (detachable-modules migration). Existing
 * `@modules/raster/utilities/raster-storage-paths` importers keep working
 * unchanged.
 */
export {
    getTrajectoryModelsPrefix,
    getTrajectoryRasterPreviewsPrefix,
    getAnalysisRasterPreviewsPrefix,
    getRasterFrameObjectName,
    getAnalysisRasterFrameObjectName,
    parseRasterTimestep,
    parseAnalysisRasterFrameKey
} from '@shared/application/utilities/raster-storage-paths';
export type { ParsedAnalysisRasterFrameKey } from '@shared/application/utilities/raster-storage-paths';
