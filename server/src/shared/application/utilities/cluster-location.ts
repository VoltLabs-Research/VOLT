

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
