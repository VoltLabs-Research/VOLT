import { TeamClusterServiceExposureAccessMode } from '@/contracts';
import type { KeyObject } from 'node:crypto';
import verify from 'jsonwebtoken/verify.js';

interface PassphraseSecret {
    key: string | Buffer;
    passphrase: string;
}

type Secret = string | Buffer | KeyObject | PassphraseSecret;

interface TeamClusterDirectAccessTokenClaims {
    requesterKind: 'daemon' | 'server';
    requesterId: string;
    ownerClusterId: string;
    teamId: string;
    exposureId: string;
    exposureName: string;
    accessMode: TeamClusterServiceExposureAccessMode;
    iat?: number;
    exp?: number;
}

export const verifyTeamClusterDirectAccessToken = (
    secret: string,
    token: string
): TeamClusterDirectAccessTokenClaims | null => {
    try {
        return verify(token, secret as Secret) as TeamClusterDirectAccessTokenClaims;
    } catch {
        return null;
    }
};
