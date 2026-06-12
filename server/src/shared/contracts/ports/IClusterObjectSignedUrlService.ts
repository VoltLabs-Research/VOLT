import type {
    ClusterObjectAccessClaims,
    ClusterObjectSignedUrl
} from '@shared/contracts/types/ClusterObjectGateway';

type ClusterObjectTokenPayload = Omit<ClusterObjectAccessClaims, 'iat' | 'exp'>;

/**
 * Neutral cross-module port for minting/verifying signed object-access tokens.
 * Owned by the cluster module; consumed by whiteboards, trajectory, latex.
 * Canonical home in `shared/contracts`; concrete impl stays in cluster.
 */
export interface IClusterObjectSignedUrlService {
    createToken(payload: ClusterObjectTokenPayload, ttlSeconds?: number): ClusterObjectSignedUrl;
    verify(token: string): ClusterObjectAccessClaims | null;
}
