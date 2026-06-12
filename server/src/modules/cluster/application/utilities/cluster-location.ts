/**
 * Re-export shim. The canonical cluster-location helpers now live in the neutral
 * `@shared/application/utilities/cluster-location` (detachable-modules
 * migration). Existing `@modules/cluster/application/utilities/cluster-location`
 * importers keep working unchanged.
 */
export {
    resolveTrajectoryStorageClusterId,
    resolveAnalysisComputeClusterId,
    resolveAnalysisStorageClusterId,
    resolveSceneArtifactStorageClusterId
} from '@shared/application/utilities/cluster-location';
