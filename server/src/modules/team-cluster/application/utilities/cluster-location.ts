import type { AnalysisProps } from '@modules/analysis/domain/entities/Analysis';
import type { TeamClusterRoleCapabilitiesProps } from '@modules/team-cluster/domain/entities/TeamCluster';
import type { TeamClusterDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';
import type { SceneArtifactProps } from '@modules/trajectory/domain/entities/scene-artifacts/SceneArtifact';
import type { TrajectoryProps } from '@modules/trajectory/domain/entities/trajectory/Trajectory';

const readLegacyClusterId = (value: unknown): string | undefined => {
    if (typeof value === 'string' && value.length > 0) {
        return value;
    }

    if (typeof value === 'object'
        && value !== null
        && '_id' in value
        && typeof value._id === 'string'
        && value._id.length > 0) {
        return value._id;
    }

    return undefined;
};

export const resolveClusterReferenceId = (value: unknown): string | undefined => {
    return readLegacyClusterId(value);
};

export const resolveTrajectoryStorageClusterId = (
    trajectory: Pick<TrajectoryProps, 'storageClusterId' | 'teamCluster'>
): string | undefined => {
    return trajectory.storageClusterId ?? readLegacyClusterId(trajectory.teamCluster);
};

export const resolveAnalysisComputeClusterId = (
    analysis: Pick<AnalysisProps, 'computeClusterId' | 'teamCluster'>
): string | undefined => {
    return analysis.computeClusterId ?? readLegacyClusterId(analysis.teamCluster);
};

export const resolveAnalysisStorageClusterId = (
    analysis: Pick<AnalysisProps, 'storageClusterId'>,
    trajectory?: Pick<TrajectoryProps, 'storageClusterId' | 'teamCluster'>
): string | undefined => {
    return analysis.storageClusterId
        ?? (trajectory ? resolveTrajectoryStorageClusterId(trajectory) : undefined);
};

export const resolveSceneArtifactStorageClusterId = (
    sceneArtifact: Pick<SceneArtifactProps, 'storageClusterId' | 'teamCluster'>
): string | undefined => {
    return sceneArtifact.storageClusterId ?? readLegacyClusterId(sceneArtifact.teamCluster);
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
