import type {
    ClusterObjectAccessClaims,
    ClusterObjectSignedUrl
} from '@shared/contracts/types/ClusterObjectGateway';

type ClusterObjectTokenPayload = Omit<ClusterObjectAccessClaims, 'iat' | 'exp'>;

export interface IClusterObjectSignedUrlService {
    createToken(payload: ClusterObjectTokenPayload, ttlSeconds?: number): ClusterObjectSignedUrl;
    verify(token: string): ClusterObjectAccessClaims | null;
}
