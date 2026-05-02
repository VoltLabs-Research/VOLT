import type { TeamClusterCredentialServices } from '@/modules/cluster/api/entities/team-cluster';

export interface RevealTeamClusterCredentialsInputDTO {
    teamId: string;
    teamClusterId: string;
    password: string;
}

export interface RevealTeamClusterCredentialsOutputDTO {
    teamClusterId: string;
    services: TeamClusterCredentialServices;
}
