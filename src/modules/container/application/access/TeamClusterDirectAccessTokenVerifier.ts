import { TeamClusterServiceExposureAccessMode } from '@/contracts';
import jwt from 'jsonwebtoken';
import type { JwtPayload, Secret } from 'jsonwebtoken';

interface TeamClusterDirectAccessTokenClaims extends JwtPayload {
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

export const verifyTeamClusterDirectAccessToken = (
    secret: string,
    token: string
): TeamClusterDirectAccessTokenClaims | null => {
    try {
        return jwt.verify(token, secret as Secret) as TeamClusterDirectAccessTokenClaims;
    } catch {
        return null;
    }
};
