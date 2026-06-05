import type {
    ClusterObjectAccessClaims,
    ClusterObjectSignedUrl
} from '@modules/cluster/application/dtos/ClusterObjectGatewayDTO';

type ClusterObjectTokenPayload = Omit<ClusterObjectAccessClaims, 'iat' | 'exp'>;

export interface IClusterObjectSignedUrlService {
    createToken(payload: ClusterObjectTokenPayload, ttlSeconds?: number): ClusterObjectSignedUrl;
    verify(token: string): ClusterObjectAccessClaims | null;
}
