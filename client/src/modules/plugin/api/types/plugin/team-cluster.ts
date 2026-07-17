import type { TeamClusterRuntimeRoleConfig } from '@/modules/cluster/api/types/team-cluster';

export interface PluginTeamClusterOption {
    _id: string;
    name: string;
    roleConfig?: Pick<TeamClusterRuntimeRoleConfig, 'desiredRole' | 'effectiveRole'>;
}
