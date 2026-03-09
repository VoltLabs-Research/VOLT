import type { TeamUserScopedInputDTO } from '@modules/team/application/dtos/common';
import type { TeamClusterCredentialServicesDTO } from '@modules/team-cluster/application/dtos/TeamClusterDTO';

export interface RevealTeamClusterCredentialsInputDTO extends TeamUserScopedInputDTO {
    teamClusterId: string;
    password: string;
};

export interface RevealTeamClusterCredentialsOutputDTO {
    teamClusterId: string;
    services: TeamClusterCredentialServicesDTO;
};
