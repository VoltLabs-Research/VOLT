import type { TeamClusterRuntimeRoleConfig } from '@/modules/cluster/api/entities/team-cluster';

export interface PluginTeamClusterOption {
    _id: string;
    name: string;
    roleConfig?: Pick<TeamClusterRuntimeRoleConfig, 'desiredRole' | 'effectiveRole'>;
};
