import type { TeamClusterCredentialServicesDTO } from '@modules/cluster/application/dtos/TeamClusterDTO';
import type { PasswordConfirmedTeamClusterInputDTO } from './common';

export type RevealTeamClusterCredentialsInputDTO = PasswordConfirmedTeamClusterInputDTO;

export interface RevealTeamClusterCredentialsOutputDTO {
    teamClusterId: string;
    services: TeamClusterCredentialServicesDTO;
}
