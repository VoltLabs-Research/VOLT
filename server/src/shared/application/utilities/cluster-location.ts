/**
 * Pure cross-module helpers for resolving which cluster a piece of work
 * stores/computes on. Canonical home in the neutral `shared` layer
 * (detachable-modules migration) so trajectory/analysis/plugin/raster/cluster
 * needn't import `@modules/cluster` for these. Uses STRUCTURAL parameter types
 * (just the one field each reads) so this file imports no module code.
 *
 * The original `@modules/cluster/utilities/cluster-location`
 * re-exports these for backward compatibility.
 */

export const resolveTrajectoryStorageClusterId = (
    trajectory: { storageClusterId?: string }
): string | undefined => {
    return trajectory.storageClusterId;
};

export const resolveAnalysisComputeClusterId = (
    analysis: { computeClusterId?: string }
): string | undefined => {
    return analysis.computeClusterId;
};

export const resolveAnalysisStorageClusterId = (
    analysis: { storageClusterId?: string }
): string | undefined => {
    return analysis.storageClusterId;
};

export const resolveSceneArtifactStorageClusterId = (
    sceneArtifact: { storageClusterId?: string }
): string | undefined => {
    return sceneArtifact.storageClusterId;
};
