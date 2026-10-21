import type {
    ClusterObjectAccessClaims,
    ClusterObjectSignedUrl
} from '@shared/contracts/types/ClusterObjectGateway';
import { signJwt, verifyJwt } from '@shared/utilities/jwt';

type ClusterObjectTokenPayload = Omit<ClusterObjectAccessClaims, 'iat' | 'exp'>;

const DEFAULT_TTL_SECONDS = 15 * 60;

const getSecret = (): string => {
    const secret = process.env.CLUSTER_OBJECT_SIGNING_SECRET || process.env.SECRET_KEY;
    if (!secret) {
        throw new Error('CLUSTER_OBJECT_SIGNING_SECRET or SECRET_KEY must be configured');
    }

    return secret;
};

const isClusterObjectClaims = (value: unknown): value is ClusterObjectAccessClaims => (
    typeof value === 'object'
    && value !== null
    && 'kind' in value
    && value.kind === 'cluster-object'
);

class ClusterObjectSignedUrlService {
    private readonly secret = getSecret();

    async createToken(payload: ClusterObjectTokenPayload, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<ClusterObjectSignedUrl> {
        const token = await signJwt({ ...payload }, this.secret, ttlSeconds);
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

        return {
            url: `/api/teams/${encodeURIComponent(payload.teamId)}/cluster-objects/${token}`,
            expiresAt
        };
    }

    async verify(token: string): Promise<ClusterObjectAccessClaims | null> {
        const claims = await verifyJwt(token, this.secret);
        return isClusterObjectClaims(claims) ? claims : null;
    }
}

export default new ClusterObjectSignedUrlService();
