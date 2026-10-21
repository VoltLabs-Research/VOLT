import jwt from 'jsonwebtoken';
import type { TeamClusterDirectAccessTokenClaims } from '@voltstack/daemon-cluster-client';

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
