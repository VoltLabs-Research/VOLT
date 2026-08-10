import type { TeamCluster, TeamClusterRole } from '@volt/contracts/modules/cluster/domain';
import type { ClusterSelectOption } from '@/modules/cluster/components/shared/ClusterOptionSelect';
import type { ClusterBadgeTone } from '@/modules/cluster/components/shared/ClusterStatusBadge';

interface TeamClusterRoleOption extends ClusterSelectOption {
    value: TeamClusterRole;
    summary: string;
    badgeVariant: ClusterBadgeTone;
}

const TEAM_CLUSTER_ROLE_META: Record<TeamClusterRole, TeamClusterRoleOption> = {
    'cluster': {
        value: 'cluster',
        title: 'Cluster',
        description: 'Runs compute jobs and also owns authoritative storage.',
        summary: 'Compute + storage',
        badgeVariant: 'brand'
    },
    'storage-server': {
        value: 'storage-server',
        title: 'Storage server',
        description: 'Accepts authoritative writes and serves downloads, but does not run compute jobs.',
        summary: 'Storage only',
        badgeVariant: 'primary'
    },
    'compute-node': {
        value: 'compute-node',
        title: 'Compute node',
        description: 'Runs compute jobs with remote reads and writes, but does not own authoritative storage.',
        summary: 'Compute only',
        badgeVariant: 'neutral'
    }
};

export const TEAM_CLUSTER_ROLE_OPTIONS: TeamClusterRoleOption[] = Object.values(TEAM_CLUSTER_ROLE_META);

export const getTeamClusterRoleLabel = (role: TeamClusterRole): string => {
    return TEAM_CLUSTER_ROLE_META[role].title;
};

export const getTeamClusterRoleDescription = (role: TeamClusterRole): string => {
    return TEAM_CLUSTER_ROLE_META[role].description ?? role;
};

export const getTeamClusterRoleSummary = (role: TeamClusterRole): string => {
    return TEAM_CLUSTER_ROLE_META[role].summary;
};

export const getTeamClusterRoleBadgeVariant = (role: TeamClusterRole): ClusterBadgeTone => {
    return TEAM_CLUSTER_ROLE_META[role].badgeVariant;
};

/**
 * Narrows a `Select`'s emitted key back to the union. bravais's `Select` handed
 * back a bare `string` and the call site asserted; HeroUI's hands back a React
 * `Key`, so the check is done once here against the same record the options are
 * built from — the option list and the guard cannot drift apart.
 */
export const isTeamClusterRole = (value: string): value is TeamClusterRole => {
    return Object.hasOwn(TEAM_CLUSTER_ROLE_META, value);
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
