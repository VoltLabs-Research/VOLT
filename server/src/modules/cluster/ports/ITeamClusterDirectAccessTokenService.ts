import type { TeamClusterDirectAccessTokenClaims } from '@modules/cluster/contracts/TeamClusterDirectAccessToken';

export interface ITeamClusterDirectAccessTokenService {
    create(secret: string, claims: TeamClusterDirectAccessTokenClaims): string;
    verify(secret: string, token: string): TeamClusterDirectAccessTokenClaims | null;
}
