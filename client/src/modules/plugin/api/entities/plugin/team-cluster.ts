import type { TeamClusterRole } from '@/modules/cluster/api/entities/team-cluster';

export interface PluginTeamClusterOption {
    _id: string;
    name: string;
    role: TeamClusterRole;
};
