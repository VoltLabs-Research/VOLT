import { TeamClusterServiceExposureAccessMode } from '@/shared/contracts';
import { createHmac, timingSafeEqual } from 'node:crypto';

interface TeamClusterDirectAccessTokenClaims {
    requesterKind: 'daemon' | 'server';
    requesterId: string;
    ownerClusterId: string;
    teamId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    iat: number;
    exp: number;
}

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

const signPayload = (encodedPayload: string, secret: string): Buffer => {
    return createHmac('sha256', secret)
        .update(encodedPayload)
        .digest();
};

export const verifyTeamClusterDirectAccessToken = (
    secret: string,
    token: string
): TeamClusterDirectAccessTokenClaims | null => {
    const [encodedPayload, encodedSignature] = token.split('.');
    if (!encodedPayload || !encodedSignature) {
        return null;
    }

    let signatureBuffer: Buffer;
    try {
        signatureBuffer = Buffer.from(encodedSignature, 'base64url');
    } catch {
        return null;
    }

    const expectedSignature = signPayload(encodedPayload, secret);
    if (
        expectedSignature.length !== signatureBuffer.length
        || !timingSafeEqual(expectedSignature, signatureBuffer)
    ) {
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
};
