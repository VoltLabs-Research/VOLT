import jwt from 'jsonwebtoken';
import type { JwtPayload, Secret, SignOptions } from 'jsonwebtoken';

interface ContainerPortProxyAccessTokenContext {
    teamId: string;
    containerId: string;
    privatePort: number;
    userId: string;
};

interface BuildContainerPortProxyUrlInput extends ContainerPortProxyAccessTokenContext {
    createAccessToken: (input: ContainerPortProxyAccessTokenContext) => string;
    targetPath?: string;
};

interface ContainerPortProxyPathMatch {
    teamId: string;
    containerId: string;
    privatePort: number;
};

interface ContainerPortProxyAccessTokenClaims extends JwtPayload {
    type: 'container-port-proxy';
    teamId: string;
    containerId: string;
    privatePort: number;
    userId: string;
};

export interface VerifiedContainerPortProxyAccessToken {
    teamId: string;
    containerId: string;
    privatePort: number;
    userId: string;
};

export const CONTAINER_PORT_PROXY_BASE_PATH = '/api/container-port-proxy';
export const CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM = 'access_token';
export const CONTAINER_PORT_PROXY_ACCESS_TOKEN_COOKIE_NAME = 'voltContainerPortProxyAccessToken';

const PROXY_URL_ORIGIN = 'http://volt.local';

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
        && typeof payload.teamId === 'string'
        && typeof payload.containerId === 'string'
        && typeof payload.privatePort === 'number'
        && typeof payload.userId === 'string';
};

export const resolveServerBaseUrl = (): string => {
    const configuredServerUrl = process.env.SERVER_ENDPOINT?.trim();
    if (configuredServerUrl) {
        return configuredServerUrl.replace(/\/+$/g, '');
    }

    const protocol = process.env.SERVER_SCHEMA?.trim() || 'http';
    const host = process.env.SERVER_HOSTNAME?.trim() || 'localhost';
    return `${protocol}://${host}`;
};

export const buildContainerPortProxyBasePath = (
    teamId: string,
    containerId: string,
    privatePort: number
): string => {
    return `${CONTAINER_PORT_PROXY_BASE_PATH}/${encodeURIComponent(teamId)}/${encodeURIComponent(containerId)}/${privatePort}`;
};

export const buildContainerPortProxyUrl = (input: BuildContainerPortProxyUrlInput): string => {
    const accessToken = input.createAccessToken({
        teamId: input.teamId,
        containerId: input.containerId,
        privatePort: input.privatePort,
        userId: input.userId
    });
    const proxyUrl = new URL(
        `${buildContainerPortProxyBasePath(input.teamId, input.containerId, input.privatePort)}${input.targetPath || ''}`,
        resolveServerBaseUrl()
    );

    proxyUrl.searchParams.set(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM, accessToken);
    return proxyUrl.toString();
};

export const matchContainerPortProxyPath = (requestUrl: string): ContainerPortProxyPathMatch | null => {
    const url = new URL(requestUrl, PROXY_URL_ORIGIN);
    const match = url.pathname.match(/^\/api\/container-port-proxy\/([^/]+)\/([^/]+)\/(\d+)(\/.*)?$/);
    if (!match) {
        return null;
    }

    const privatePort = Number(match[3]);
    if (!Number.isInteger(privatePort) || privatePort <= 0) {
        return null;
    }

    return {
        teamId: decodeURIComponent(match[1]),
        containerId: decodeURIComponent(match[2]),
        privatePort
    };
};

export const readContainerPortProxyAccessTokenFromUrl = (requestUrl: string): string | null => {
    const url = new URL(requestUrl, PROXY_URL_ORIGIN);
    return url.searchParams.get(CONTAINER_PORT_PROXY_ACCESS_TOKEN_QUERY_PARAM);
};

export class ContainerPortProxyAccessTokenService {
    private readonly secret = getSecretKey();
    private readonly signOptions: SignOptions = {
        expiresIn: '10m'
    };

    create(input: ContainerPortProxyAccessTokenContext): string {
        return jwt.sign({
            type: 'container-port-proxy',
            teamId: input.teamId,
            containerId: input.containerId,
            privatePort: input.privatePort,
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
                teamId: decoded.teamId,
                containerId: decoded.containerId,
                privatePort: decoded.privatePort,
                userId: decoded.userId
            };
        } catch {
            return null;
        }
    }
}
