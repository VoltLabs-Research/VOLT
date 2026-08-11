import jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';
import type { IClusterObjectSignedUrlService } from '@shared/contracts/ports/IClusterObjectSignedUrlService';
import type {
    ClusterObjectAccessClaims,
    ClusterObjectSignedUrl
} from '@shared/contracts/types/ClusterObjectGateway';

type ClusterObjectTokenPayload = Omit<ClusterObjectAccessClaims, 'iat' | 'exp'>;

const DEFAULT_TTL_SECONDS = 15 * 60;

const getSecret = (): Secret => {
    const secret = process.env.CLUSTER_OBJECT_SIGNING_SECRET || process.env.SECRET_KEY;
    if (!secret) {
        throw new Error('CLUSTER_OBJECT_SIGNING_SECRET or SECRET_KEY must be configured');
    }

    return secret;
};

export default class ClusterObjectSignedUrlService implements IClusterObjectSignedUrlService {
    private readonly secret = getSecret();

    createToken(payload: ClusterObjectTokenPayload, ttlSeconds = DEFAULT_TTL_SECONDS): ClusterObjectSignedUrl {
        const signOptions: SignOptions = {
            algorithm: 'HS256',
            expiresIn: ttlSeconds
        };
        const token = jwt.sign(payload, this.secret, signOptions);
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

        return {
            url: `/api/teams/${encodeURIComponent(payload.teamId)}/cluster-objects/${token}`,
            expiresAt
        };
    }

    verify(token: string): ClusterObjectAccessClaims | null {
        try {
            const claims = jwt.verify(token, this.secret) as ClusterObjectAccessClaims;
            return claims.kind === 'cluster-object'
                ? claims
                : null;
        } catch {
            return null;
        }
    }
}
