import { SignJWT, jwtVerify } from 'jose';
import type { TeamClusterDirectAccessTokenClaims } from './objectGateway';

const DIRECT_ACCESS_TOKEN_ALGORITHM = 'HS256';

const toKey = (daemonPassword: string): Uint8Array => new TextEncoder().encode(daemonPassword);

// The server signs with the daemon's password and the daemon verifies with its own copy, so both
// ends go through these two functions and agree on algorithm and claims.
export const signTeamClusterDirectAccessToken = (
    claims: TeamClusterDirectAccessTokenClaims,
    daemonPassword: string
): Promise<string> => (
    new SignJWT({ ...claims })
        .setProtectedHeader({ alg: DIRECT_ACCESS_TOKEN_ALGORITHM, typ: 'JWT' })
        .sign(toKey(daemonPassword))
);

export const verifyTeamClusterDirectAccessToken = async (
    token: string,
    daemonPassword: string
): Promise<TeamClusterDirectAccessTokenClaims | null> => {
    try{
        const { payload } = await jwtVerify<TeamClusterDirectAccessTokenClaims>(token, toKey(daemonPassword), {
            algorithms: [DIRECT_ACCESS_TOKEN_ALGORITHM]
        });
        return payload;
    }catch{
        return null;
    }
};
