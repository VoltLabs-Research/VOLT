import { TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import { secureCompare } from '@modules/team-cluster/utilities/secureCompare';
import { createHmac } from 'node:crypto';
import { injectable } from 'tsyringe';

type DirectAccessRequesterKind = 'daemon' | 'server';

export interface TeamClusterDirectAccessTokenClaims {
    requesterKind: DirectAccessRequesterKind;
    requesterId: string;
    ownerClusterId: string;
    teamId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    iat: number;
    exp: number;
}

const encodeBase64Url = (value: Buffer | string): string => {
    return Buffer.isBuffer(value)
        ? value.toString('base64url')
        : Buffer.from(value, 'utf8').toString('base64url');
};

const decodeBase64UrlJson = <T>(value: string): T | null => {
    try {
        return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
    } catch {
        return null;
    }
};

const isClaimsPayload = (value: unknown): value is TeamClusterDirectAccessTokenClaims => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return false;
    }

    const payload = value as Partial<TeamClusterDirectAccessTokenClaims>;

    return (
        (payload.requesterKind === 'daemon' || payload.requesterKind === 'server')
        && typeof payload.requesterId === 'string'
        && payload.requesterId.length > 0
        && typeof payload.ownerClusterId === 'string'
        && payload.ownerClusterId.length > 0
        && typeof payload.teamId === 'string'
        && payload.teamId.length > 0
        && typeof payload.exposureId === 'string'
        && payload.exposureId.length > 0
        && typeof payload.exposureName === 'string'
        && payload.exposureName.length > 0
        && Object.values(TeamClusterServiceExposureAccessMode).includes(payload.accessMode as TeamClusterServiceExposureAccessMode)
        && typeof payload.iat === 'number'
        && Number.isFinite(payload.iat)
        && typeof payload.exp === 'number'
        && Number.isFinite(payload.exp)
    );
};

const signPayload = (encodedPayload: string, secret: string): string => {
    return createHmac('sha256', secret)
        .update(encodedPayload)
        .digest('base64url');
};

@injectable()
export default class TeamClusterDirectAccessTokenService {
    create(secret: string, claims: TeamClusterDirectAccessTokenClaims): string {
        const encodedPayload = encodeBase64Url(JSON.stringify(claims));
        const signature = signPayload(encodedPayload, secret);
        return `${encodedPayload}.${signature}`;
    }

    verify(secret: string, token: string): TeamClusterDirectAccessTokenClaims | null {
        const [encodedPayload, encodedSignature] = token.split('.');
        if (!encodedPayload || !encodedSignature) {
            return null;
        }

        const expectedSignature = signPayload(encodedPayload, secret);
        if (!secureCompare(expectedSignature, encodedSignature)) {
            return null;
        }

        const payload = decodeBase64UrlJson<unknown>(encodedPayload);
        if (!isClaimsPayload(payload)) {
            return null;
        }

        if (payload.exp <= Math.floor(Date.now() / 1000)) {
            return null;
        }

        return payload;
    }
}
