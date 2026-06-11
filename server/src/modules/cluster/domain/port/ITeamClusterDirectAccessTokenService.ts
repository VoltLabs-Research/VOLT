import type { TeamClusterDirectAccessTokenClaims } from '@modules/cluster/infrastructure/services/TeamClusterDirectAccessTokenService';

export interface ITeamClusterDirectAccessTokenService {
    create(secret: string, claims: TeamClusterDirectAccessTokenClaims): string;
    verify(secret: string, token: string): TeamClusterDirectAccessTokenClaims | null;
}
