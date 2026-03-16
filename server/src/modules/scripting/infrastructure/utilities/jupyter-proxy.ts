import path from 'node:path';
import type { Response } from 'express';

interface JupyterProxyAccessTokenContext {
    teamId: string;
    runtimeNotebookId: string;
    userId: string;
};

interface BuildJupyterProxyUrlInput extends JupyterProxyAccessTokenContext {
    notebookPath?: string;
    daemonPath?: string;
    createAccessToken: (input: JupyterProxyAccessTokenContext) => string;
};

interface JupyterProxyPathMatch {
    teamId: string;
    runtimeNotebookId: string;
};

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
    const accessToken = input.createAccessToken({
        teamId: input.teamId,
        runtimeNotebookId: input.runtimeNotebookId,
        userId: input.userId
    });
    const proxyTargetPath = resolveJupyterProxyTargetPath(input);
    const proxyUrl = new URL(
        `${buildJupyterProxyBasePath(input.teamId, input.runtimeNotebookId)}${proxyTargetPath}`,
        resolveServerBaseUrl()
    );

    proxyUrl.searchParams.set(JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM, accessToken);
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

export const readJupyterProxyAccessTokenFromUrl = (requestUrl: string): string | null => {
    const url = new URL(requestUrl, PROXY_URL_ORIGIN);
    return url.searchParams.get(JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM);
};

export const persistJupyterProxyAccessCookieFromUrl = (res: Response, jupyterUrl: string): void => {
    const accessToken = readJupyterProxyAccessTokenFromUrl(jupyterUrl);
    const proxyPath = matchJupyterProxyPath(jupyterUrl);
    if (!accessToken || !proxyPath) {
        return;
    }

    res.cookie(JUPYTER_PROXY_ACCESS_TOKEN_COOKIE_NAME, accessToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: buildJupyterProxyBasePath(proxyPath.teamId, proxyPath.runtimeNotebookId)
    });
};
