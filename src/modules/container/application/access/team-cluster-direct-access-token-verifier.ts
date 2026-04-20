import { TeamClusterServiceExposureAccessMode } from '@/contracts';
import jwt from 'jsonwebtoken';

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
        return jwt.verify(token, secret) as TeamClusterDirectAccessTokenClaims;
    } catch {
        return null;
    }
};
