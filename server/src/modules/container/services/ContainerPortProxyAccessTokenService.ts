import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';
import { parse as parseCookie, serialize as serializeCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import type { JwtPayload, Secret } from 'jsonwebtoken';


const ACCESS_TOKEN_TYPE = 'container-port-proxy';
const ACCESS_TOKEN_QUERY_PARAM = 'access_token';
const ACCESS_TOKEN_COOKIE_NAME = 'voltContainerPortProxyAccessToken';
const DEFAULT_SESSION_TTL_MS = 600_000;
const RELAY_URL_ORIGIN = 'http://volt.local';

interface ContainerPortProxyAccessTokenContext {
    containerId: string;
    privatePort: number;
    publicPort: number;
    userId: string;
}

interface ContainerPortProxyAccessTokenClaims extends JwtPayload {
    containerId: string;
    privatePort: number;
    publicPort: number;
    userId: string;
}

interface BuildContainerPortProxyAccessUrlInput extends ContainerPortProxyAccessTokenContext {
    advertisedHost: string;
    protocol: 'http' | 'https';
}

const readSecretKey = (): Secret => {
    const key = process.env.SECRET_KEY;
    if (!key) {
        throw new Error('SECRET_KEY is required');
    }

    return key;
};

const readSessionTtlMs = (): number => {
    return readPositiveIntegerEnv('CONTAINER_PORT_PROXY_SESSION_TTL_MS', DEFAULT_SESSION_TTL_MS);
};

export class ContainerPortProxyAccessTokenService {
    private readonly secret = readSecretKey();
    private readonly signOptions = { expiresIn: Math.ceil(readSessionTtlMs() / 1000) };

    getTtlMs(): number {
        return readSessionTtlMs();
    }

    buildAccessUrl(input: BuildContainerPortProxyAccessUrlInput): string {
        const relayUrl = new URL(`${input.protocol}://${input.advertisedHost}:${input.publicPort}/`);
        relayUrl.searchParams.set(ACCESS_TOKEN_QUERY_PARAM, this.create(input));
        return relayUrl.toString();
    }

    create(input: ContainerPortProxyAccessTokenContext): string {
        return jwt.sign({
            type: ACCESS_TOKEN_TYPE,
            containerId: input.containerId,
            privatePort: input.privatePort,
            publicPort: input.publicPort,
            userId: input.userId
        }, this.secret, this.signOptions);
    }

    verify(token: string): ContainerPortProxyAccessTokenContext | null {
        try {
            const decoded = jwt.verify(token, this.secret);
            if (typeof decoded === 'string' || decoded.type !== ACCESS_TOKEN_TYPE) {
                return null;
            }

            const claims = decoded as ContainerPortProxyAccessTokenClaims;
            return {
                containerId: claims.containerId,
                privatePort: claims.privatePort,
                publicPort: claims.publicPort,
                userId: claims.userId
            };
        } catch {
            return null;
        }
    }

    readFromUrl(requestUrl: string): string | null {
        return new URL(requestUrl, RELAY_URL_ORIGIN).searchParams.get(ACCESS_TOKEN_QUERY_PARAM);
    }

    readFromRequest(requestUrl: string, cookieHeader: string | undefined): string | null {
        const cookieToken = cookieHeader ? parseCookie(cookieHeader)[ACCESS_TOKEN_COOKIE_NAME] : undefined;
        return this.readFromUrl(requestUrl) || cookieToken || null;
    }

    appendCookie(existing: string[] | undefined, accessToken: string): string[] {
        const accessTokenCookie = serializeCookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax',
            maxAge: Math.max(1, Math.floor(this.getTtlMs() / 1000))
        });

        return existing ? [...existing, accessTokenCookie] : [accessTokenCookie];
    }

    stripFromUrl(requestUrl: string): URL {
        const url = new URL(requestUrl, RELAY_URL_ORIGIN);
        url.searchParams.delete(ACCESS_TOKEN_QUERY_PARAM);
        return url;
    }
}

export default new ContainerPortProxyAccessTokenService();
