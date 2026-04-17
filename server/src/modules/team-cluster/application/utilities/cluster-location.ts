import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { TeamClusterRoleCapabilitiesProps } from '@modules/team-cluster/domain/entities/TeamCluster';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
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

export const isTeamClusterConnected = (teamCluster: TeamClusterDTO): boolean => {
    return teamCluster.status === 'connected';
};

export const supportsStorageWrites = (teamCluster: TeamClusterDTO): boolean => {
    return teamCluster.effectiveCapabilities.acceptsStorageWrites;
};

export const supportsComputeJobs = (teamCluster: TeamClusterDTO): boolean => {
    return teamCluster.effectiveCapabilities.acceptsComputeJobs;
};

export const supportsRoleCapabilities = (
    roleCapabilities: TeamClusterRoleCapabilitiesProps,
    requirements: Partial<TeamClusterRoleCapabilitiesProps>
): boolean => {
    if (requirements.canStore === true && roleCapabilities.canStore !== true) {
        return false;
    }

    if (requirements.canCompute === true && roleCapabilities.canCompute !== true) {
        return false;
    }

    return true;
};
