import type { TeamCluster, TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';
import type { SelectOption, StatusBadgeProps } from '@voltstack/bravais';

export interface TeamClusterRoleOption extends SelectOption {
    value: TeamClusterRole;
}

export const TEAM_CLUSTER_ROLE_OPTIONS: TeamClusterRoleOption[] = [
    {
        value: 'cluster',
        title: 'Cluster',
        description: 'Runs compute jobs and also owns authoritative storage.'
    },
    {
        value: 'storage-server',
        title: 'Storage server',
        description: 'Accepts authoritative writes and serves downloads, but does not run compute jobs.'
    },
    {
        value: 'compute-node',
        title: 'Compute node',
        description: 'Runs compute jobs with remote reads and writes, but does not own authoritative storage.'
    }
];

export const getTeamClusterRoleLabel = (role: TeamClusterRole): string => {
    const option = TEAM_CLUSTER_ROLE_OPTIONS.find((candidate) => candidate.value === role);
    return option?.title ?? role;
};

export const getTeamClusterRoleDescription = (role: TeamClusterRole): string => {
    const option = TEAM_CLUSTER_ROLE_OPTIONS.find((candidate) => candidate.value === role);
    return option?.description ?? role;
};

export const getTeamClusterRoleSummary = (role: TeamClusterRole): string => {
    switch (role) {
        case 'cluster':
            return 'Compute + storage';
        case 'storage-server':
            return 'Storage only';
        case 'compute-node':
            return 'Compute only';
    }
};

export const getTeamClusterRoleBadgeVariant = (role: TeamClusterRole): StatusBadgeProps['variant'] => {
    switch (role) {
        case 'cluster':
            return 'brand';
        case 'storage-server':
            return 'primary';
        case 'compute-node':
            return 'neutral';
    }
};

export const describeTeamClusterDraining = (teamCluster: TeamCluster): string | null => {
    const drainingScopes: string[] = [];

    if (teamCluster.roleConfig.draining.compute) {
        drainingScopes.push('compute');
    }

    if (teamCluster.roleConfig.draining.storage) {
        drainingScopes.push('storage');
    }

    return drainingScopes.length > 0
        ? `Draining ${drainingScopes.join(' + ')}`
        : null;
};

export const isTeamClusterRoleTransitionPending = (teamCluster: TeamCluster): boolean => {
    return teamCluster.roleConfig.desiredRole !== teamCluster.roleConfig.effectiveRole
        || teamCluster.roleConfig.draining.compute
        || teamCluster.roleConfig.draining.storage;
};
