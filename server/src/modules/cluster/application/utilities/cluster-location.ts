import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

export const resolveTrajectoryStorageClusterId = (
    trajectory: Pick<TrajectoryProps, 'storageClusterId'>
): string | undefined => {
    return trajectory.storageClusterId;
};

export const resolveAnalysisComputeClusterId = (
    analysis: Pick<AnalysisProps, 'computeClusterId'>
): string | undefined => {
    return analysis.computeClusterId;
};

export const resolveAnalysisStorageClusterId = (
    analysis: Pick<AnalysisProps, 'storageClusterId'>
): string | undefined => {
    return analysis.storageClusterId;
};

export const resolveSceneArtifactStorageClusterId = (
    sceneArtifact: Pick<SceneArtifactProps, 'storageClusterId'>
): string | undefined => {
    return sceneArtifact.storageClusterId;
};
