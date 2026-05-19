import { Singleton } from '@shared/infrastructure/di/decorators';
import jwt from 'jsonwebtoken';
import type { Secret, SignOptions } from 'jsonwebtoken';
import type {
    ClusterObjectAccessClaims,
    ClusterObjectOperation,
    ClusterObjectSignedUrl
} from '@modules/cluster/application/dtos/ClusterObjectGatewayDTO';

type ClusterObjectTokenPayload = Omit<ClusterObjectAccessClaims, 'iat' | 'exp'>;

const DEFAULT_TTL_SECONDS = 15 * 60;

const getSecret = (): Secret => {
    const secret = process.env.CLUSTER_OBJECT_SIGNING_SECRET || process.env.SECRET_KEY;
    if (!secret) {
        throw new Error('CLUSTER_OBJECT_SIGNING_SECRET or SECRET_KEY must be configured');
    }

    return secret;
};

const isClaims = (value: unknown): value is ClusterObjectAccessClaims => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Partial<ClusterObjectAccessClaims>;
    return candidate.kind === 'cluster-object'
        && (candidate.operation === 'read' || candidate.operation === 'write')
        && typeof candidate.teamId === 'string'
        && typeof candidate.userId === 'string'
        && typeof candidate.ownerClusterId === 'string'
        && typeof candidate.bucket === 'string'
        && typeof candidate.objectKey === 'string'
        && typeof candidate.resourceKind === 'string'
        && typeof candidate.resourceId === 'string'
        && typeof candidate.iat === 'number'
        && typeof candidate.exp === 'number';
};

@Singleton()
export default class ClusterObjectSignedUrlService {
    private readonly secret = getSecret();

    createToken(payload: ClusterObjectTokenPayload, ttlSeconds = DEFAULT_TTL_SECONDS): ClusterObjectSignedUrl {
        const signOptions: SignOptions = {
            algorithm: 'HS256',
            expiresIn: ttlSeconds
        };
        const token = jwt.sign(payload, this.secret, signOptions);
        const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
        const operationPath: ClusterObjectOperation = payload.operation;

        return {
            url: `/api/cluster-objects/${encodeURIComponent(payload.teamId)}/${operationPath}/${token}`,
            expiresAt
        };
    }

    verify(token: string): ClusterObjectAccessClaims | null {
        try {
            const decoded = jwt.verify(token, this.secret);
            return isClaims(decoded) ? decoded : null;
        } catch {
            return null;
        }
    }
}
