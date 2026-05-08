import path from 'node:path';
import type { CookieOptions, Request, Response } from 'express';

interface BuildJupyterProxyUrlInput {
    teamId: string;
    runtimeNotebookId: string;
    notebookPath?: string;
    daemonPath?: string;
    accessToken?: string;
}

interface JupyterProxyPathMatch {
    teamId: string;
    runtimeNotebookId: string;
}

export const JUPYTER_PROXY_BASE_PATH = '/api/jupyter';
export const JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM = 'access_token';
export const JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME = 'voltScriptingJupyterAccessToken';

const PROXY_URL_ORIGIN = 'http://volt.local';

export const resolveServerBaseUrl = (): string => {
    const configuredServerUrl = process.env.SERVER_ENDPOINT?.trim();
    if (configuredServerUrl) {
        return configuredServerUrl.replace(/\/+$/g, '');
    }

    const protocol = process.env.SERVER_SCHEMA?.trim() || 'http';
    const host = process.env.SERVER_HOSTNAME?.trim() || 'localhost';
    return `${protocol}://${host}`;
};

const resolveJupyterUiPath = (): string => {
    const configuredUiPath = process.env.JUPYTER_UI_PATH?.trim() || '/lab';
    const normalizedUiPath = configuredUiPath.startsWith('/') ? configuredUiPath : `/${configuredUiPath}`;

    return normalizedUiPath === '/doc' ? '/lab' : normalizedUiPath;
};

const normalizeJupyterProxyTargetPath = (value: string): string => {
    return value.startsWith('/') ? value : `/${value}`;
};

const resolveJupyterProxyTargetPath = (input: BuildJupyterProxyUrlInput): string => {
    if (input.daemonPath) {
        return normalizeJupyterProxyTargetPath(input.daemonPath);
    }

    if (!input.notebookPath) {
        return '';
    }

    const encodedNotebookPath = input.notebookPath.split('/').map(encodeURIComponent).join('/');
    return path.posix.join(resolveJupyterUiPath(), 'tree', encodedNotebookPath);
};

export const buildJupyterProxyBasePath = (teamId: string, runtimeNotebookId: string): string => {
    return `${JUPYTER_PROXY_BASE_PATH}/${encodeURIComponent(teamId)}/notebooks/${encodeURIComponent(runtimeNotebookId)}`;
};

export const buildJupyterProxyUrl = (input: BuildJupyterProxyUrlInput): string => {
    const proxyTargetPath = resolveJupyterProxyTargetPath(input);
    const proxyUrl = new URL(
        `${buildJupyterProxyBasePath(input.teamId, input.runtimeNotebookId)}${proxyTargetPath}`,
        resolveServerBaseUrl()
    );

    if (input.accessToken) {
        proxyUrl.searchParams.set(JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM, input.accessToken);
    }

    return proxyUrl.toString();
};

export const matchJupyterProxyPath = (requestUrl: string): JupyterProxyPathMatch | null => {
    const url = new URL(requestUrl, PROXY_URL_ORIGIN);
    const match = url.pathname.match(/^\/api\/jupyter\/([^/]+)\/notebooks\/([^/]+)(\/.*)?$/);
    if (!match) {
        return null;
    }

    return {
        teamId: decodeURIComponent(match[1]),
        runtimeNotebookId: decodeURIComponent(match[2])
    };
};

const isSecureRequest = (req: Request): boolean => {
    if (req.secure) {
        return true;
    }

    const forwardedProtoHeader = req.headers['x-forwarded-proto'];
    const forwardedProto = Array.isArray(forwardedProtoHeader)
        ? forwardedProtoHeader[0]
        : forwardedProtoHeader;

    return forwardedProto?.split(',')[0]?.trim()?.toLowerCase() === 'https';
};

export const buildJupyterProxyAccessCookieOptions = (
    req: Request,
    teamId: string,
    runtimeNotebookId: string,
    maxAgeMs: number
): CookieOptions => ({
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(req),
    maxAge: maxAgeMs,
    path: buildJupyterProxyBasePath(teamId, runtimeNotebookId)
});

export const setJupyterProxyAccessCookie = (
    req: Request,
    res: Response,
    accessToken: string,
    teamId: string,
    runtimeNotebookId: string,
    maxAgeMs: number
): void => {
    res.cookie(JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME, accessToken, buildJupyterProxyAccessCookieOptions(
        req,
        teamId,
        runtimeNotebookId,
        maxAgeMs
    ));
};

export const clearJupyterProxyAccessCookie = (
    req: Request,
    res: Response,
    teamId: string,
    runtimeNotebookId: string
): void => {
    res.clearCookie(JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureRequest(req),
        path: buildJupyterProxyBasePath(teamId, runtimeNotebookId)
    });
};
