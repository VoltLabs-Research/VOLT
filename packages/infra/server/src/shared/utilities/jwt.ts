import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from 'jose';
import ms from 'ms';
import type { StringValue } from 'ms';

const JWT_ALGORITHM = 'HS256';

const isStringValue = (value: string): value is StringValue => {
    return /^\d+(?:\.\d+)?(?:\s?(?:years?|yrs?|y|weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|milliseconds?|msecs?|ms))?$/i.test(value);
};

// Keeps the TTL format the env vars always had: a bare number is seconds, anything else an `ms` duration.
export const parseJwtTtlSeconds = (value: string | undefined, fallback: StringValue): number => {
    const trimmedValue = value?.trim() ?? '';
    const numericValue = Number(trimmedValue);
    if(trimmedValue && Number.isFinite(numericValue) && String(numericValue) === trimmedValue){
        return numericValue;
    }

    return Math.floor(ms(isStringValue(trimmedValue) ? trimmedValue : fallback) / 1000);
};

const toKey = (secret: string): Uint8Array => new TextEncoder().encode(secret);

export const signJwt = (claims: JWTPayload, secret: string, ttlSeconds: number): Promise<string> => {
    const issuedAt = Math.floor(Date.now() / 1000);
    return new SignJWT(claims)
        .setProtectedHeader({
            alg: JWT_ALGORITHM,
            typ: 'JWT'
        })
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + ttlSeconds)
        .sign(toKey(secret));
};

export const verifyJwt = async (token: string, secret: string): Promise<JWTPayload | null> => {
    try{
        const { payload } = await jwtVerify(token, toKey(secret), { algorithms: [JWT_ALGORITHM] });
        return payload;
    }catch{
        return null;
    }
};
