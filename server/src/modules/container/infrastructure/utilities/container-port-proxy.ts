import jwt from 'jsonwebtoken';
import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';
import { Singleton } from '@shared/infrastructure/di/decorators';
import { readPositiveIntegerEnv } from '@shared/infrastructure/utilities/env';

interface ContainerPortProxyAccessTokenSignOptions extends SignOptions {
    expiresIn: number;
}

interface ContainerPortProxyAccessTokenContext {
    containerId: string;
    privatePort: number;
    publicPort: number;
    userId: string;
}

interface BuildContainerPortProxyRelayUrlInput extends ContainerPortProxyAccessTokenContext {
    advertisedHost: string;
    protocol: 'http' | 'https';
    createAccessToken: (input: ContainerPortProxyAccessTokenContext) => string;
}

interface ContainerPortProxyAccessTokenClaims extends JwtPayload {
    type: 'container-port-proxy';
    containerId: string;
    privatePort: number;
    publicPort: number;
    userId: string;
}

export interface VerifiedContainerPortProxyAccessToken {
    containerId: string;
    privatePort: number;
    publicPort: number;
    userId: string;
}

export const CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM = 'access_token';
export const CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME = 'voltContainerPortProxyAccessToken';

const DEFAULT_CONTAINER_PORT_PROXY_SESSION_TTL_MS = 600_000;
const RELAY_URL_ORIGIN = 'http://volt.local';

const getSecretKey = (): Secret => {
    const key = process.env.SECRET_KEY;
    if (!key) {
        throw new Error('SECRET_KEY is required');
    }

    return key;
};

const isClaimsPayload = (value: unknown): value is ContainerPortProxyAccessTokenClaims => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    const payload = value as Record<string, unknown>;
    return payload.type === 'container-port-proxy'
        && typeof payload.containerId === 'string'
        && typeof payload.privatePort === 'number'
        && typeof payload.publicPort === 'number'
        && typeof payload.userId === 'string';
};

export const resolveContainerPortProxyRelayProtocol = (): 'http' | 'https' => {
    const configuredProtocol = process.env.TEAM_CLUSTER_APP_PROXY_PROTOCOL?.trim();
    if (configuredProtocol === 'http' || configuredProtocol === 'https') {
        return configuredProtocol;
    }

    const configuredServerEndpoint = process.env.SERVER_ENDPOINT?.trim();
    if (configuredServerEndpoint) {
        try {
            const protocol = new URL(configuredServerEndpoint).protocol.replace(':', '');
            if (protocol === 'http' || protocol === 'https') {
                return protocol;
            }
        } catch {
        }
    }

    const schema = process.env.SERVER_SCHEMA?.trim();
    return schema === 'https' ? 'https' : 'http';
};

export const buildContainerPortProxyRelayUrl = (input: BuildContainerPortProxyRelayUrlInput): string => {
    const accessToken = input.createAccessToken({
        containerId: input.containerId,
        privatePort: input.privatePort,
        publicPort: input.publicPort,
        userId: input.userId
    });
    const relayUrl = new URL(`${input.protocol}://${input.advertisedHost}:${input.publicPort}/`);
    relayUrl.searchParams.set(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM, accessToken);
    return relayUrl.toString();
};

export const readContainerPortProxyAccessTokenFromUrl = (requestUrl: string): string | null => {
    const url = new URL(requestUrl, RELAY_URL_ORIGIN);
    return url.searchParams.get(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM);
};

@Singleton()
export class ContainerPortProxyAccessTokenService {
    private readonly secret = getSecretKey();
    private readonly signOptions: ContainerPortProxyAccessTokenSignOptions = {
        expiresIn: Math.ceil(
            readPositiveIntegerEnv(
                'CONTAINER_PORT_PROXY_SESSION_TTL_MS',
                DEFAULT_CONTAINER_PORT_PROXY_SESSION_TTL_MS
            ) / 1000
        )
    };

    create(input: ContainerPortProxyAccessTokenContext): string {
        return jwt.sign({
            type: 'container-port-proxy',
            containerId: input.containerId,
            privatePort: input.privatePort,
            publicPort: input.publicPort,
            userId: input.userId
        }, this.secret, this.signOptions);
    }

    verify(token: string): VerifiedContainerPortProxyAccessToken | null {
        try {
            const decoded = jwt.verify(token, this.secret);
            if (!isClaimsPayload(decoded)) {
                return null;
            }

            return {
                containerId: decoded.containerId,
                privatePort: decoded.privatePort,
                publicPort: decoded.publicPort,
                userId: decoded.userId
            };
        } catch {
            return null;
        }
    }

    getTtlMs(): number {
        return readPositiveIntegerEnv(
            'CONTAINER_PORT_PROXY_SESSION_TTL_MS',
            DEFAULT_CONTAINER_PORT_PROXY_SESSION_TTL_MS
        );
    }
}
