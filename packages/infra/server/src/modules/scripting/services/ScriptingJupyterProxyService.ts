import { ErrorCodes } from '@core/constants/error-codes';
import scriptingJupyterProxyAuthorizer from '@modules/scripting/services/ScriptingJupyterProxyAuthorizer';
import type { AuthorizedProxyContext } from '@modules/scripting/services/ScriptingJupyterProxyAuthorizer';
import {
    findNotebookExposure,
    JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM,
    JUPYTER_PROXY_BASE_PATH,
    PROXY_URL_ORIGIN
} from '@modules/scripting/services/ScriptingJupyterProxySupport';
import teamClusterExposureRegistryService from '@modules/cluster/services/team-cluster/TeamClusterExposureRegistryService';
import reverseWsHttpRelay from '@modules/cluster/services/reverse-channel/ReverseWsHttpRelay';
import ApplicationError from '@shared/errors/ApplicationError';
import { errorResponseBody, normalizeError } from '@shared/http/middleware/error';
import logger from '@shared/logger';
import { writeUpgradeError } from '@shared/utilities/proxy-relay';
import { buildWebSocketProtocolList } from '@shared/utilities/websocket-protocols';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Duplex } from 'node:stream';
import type { TeamClusterServiceExposure } from '@voltstack/daemon-cluster-client';

const JUPYTER_NATIVE_TOKEN_QUERY_PARAM = 'token';
const JUPYTER_PROXY_TEMPORARY_UNAVAILABLE_MESSAGE = 'Jupyter proxy is temporarily unavailable';
const DAEMON_PROXY_UNAVAILABLE_ERROR_MESSAGES = [
    'team cluster daemon connection was lost',
    'team cluster daemon reverse channel is not connected',
    'team cluster daemon connection is not ready yet'
];

const jupyterNativeToken = process.env.JUPYTER_TOKEN?.trim() || 'volt-scripting';

const isDaemonProxyUnavailableError = (error: unknown): boolean => {
    if (error instanceof ApplicationError && error.code === 'TeamCluster::DaemonUnavailable') {
        return true;
    }

    if (!(error instanceof Error)) {
        return false;
    }

    const normalizedMessage = error.message.toLowerCase();
    return DAEMON_PROXY_UNAVAILABLE_ERROR_MESSAGES.some((message) => normalizedMessage.includes(message));
};

const mapNotebookProxyError = (error: unknown): unknown => {
    if (!isDaemonProxyUnavailableError(error)) {
        return error;
    }

    return new ApplicationError(
        ErrorCodes.SCRIPTING_DAEMON_UNAVAILABLE,
        JUPYTER_PROXY_TEMPORARY_UNAVAILABLE_MESSAGE,
        503
    );
};

const requireNotebookRuntime = (context: AuthorizedProxyContext): TeamClusterServiceExposure => {
    const exposures = teamClusterExposureRegistryService.listTeamClusterExposures(context.teamClusterId);
    const match = findNotebookExposure(exposures, context.runtimeNotebookId);

    if (!match || !match.ready) {
        throw new ApplicationError(
            ErrorCodes.SCRIPTING_JUPYTER_UNAVAILABLE,
            'Jupyter runtime is not ready yet',
            503
        );
    }

    return match.exposure;
};

// JupyterLab runs under the proxy's own path (its base_url), so a request goes upstream with that
// path; only VOLT's access token is swapped for Jupyter's.
const toUpstreamPath = (requestUrl: string): string => {
    const url = new URL(requestUrl, PROXY_URL_ORIGIN);

    url.searchParams.delete(JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM);
    url.searchParams.set(JUPYTER_NATIVE_TOKEN_QUERY_PARAM, jupyterNativeToken);

    return `${url.pathname}?${url.searchParams.toString()}`;
};

const writeHttpError = (response: ServerResponse, error: unknown): void => {
    if (response.headersSent) {
        response.destroy();
        return;
    }

    const normalizedError = normalizeError(mapNotebookProxyError(error));
    response.writeHead(normalizedError.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(errorResponseBody(normalizedError)));
};

class ScriptingJupyterProxyService {
    isJupyterRequest(request: IncomingMessage): boolean {
        return (request.url || '').startsWith(`${JUPYTER_PROXY_BASE_PATH}/`);
    }

    // Requests bypass Express, so bodies (notebook saves, uploads) stream through unparsed.
    public handleHttp = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
        const requestUrl = request.url || '';

        try {
            const context = await scriptingJupyterProxyAuthorizer.authorize(requestUrl, request.headers.cookie);

            await reverseWsHttpRelay.proxyHttp({
                teamClusterId: context.teamClusterId,
                exposure: requireNotebookRuntime(context),
                req: request,
                res: response,
                rewrittenUrl: toUpstreamPath(requestUrl),
                onError: (error: Error) => {
                    logger.warn(`Jupyter proxy request failed requestUrl=${requestUrl} error=${error.message}`);
                    writeHttpError(response, error);
                }
            });
        } catch (error: unknown) {
            writeHttpError(response, error);
        }
    };

    public handleUpgrade = async (request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
        const requestUrl = request.url || '';

        try {
            const context = await scriptingJupyterProxyAuthorizer.authorize(requestUrl, request.headers.cookie);
            const exposure = requireNotebookRuntime(context);
            const requestedProtocols = buildWebSocketProtocolList(request.headers['sec-websocket-protocol']);
            const upstreamWebSocketUrl = `ws://${exposure.targetHost}:${exposure.targetPort}${toUpstreamPath(requestUrl)}`;

            logger.info({
                requestUrl,
                teamId: context.teamId,
                runtimeNotebookId: context.runtimeNotebookId,
                teamClusterId: context.teamClusterId,
                upstreamWebSocketUrl,
                upstreamHost: exposure.targetHost,
                upstreamPort: exposure.targetPort,
                requestedProtocols
            }, 'Opening proxied Jupyter websocket');

            await reverseWsHttpRelay.proxyWebSocketUpgrade({
                teamClusterId: context.teamClusterId,
                request,
                socket,
                head,
                upstreamWebSocketUrl,
                requestedProtocols
            });
        } catch (error: unknown) {
            const mappedError = mapNotebookProxyError(error);
            const statusCode = mappedError instanceof ApplicationError ? mappedError.statusCode : 500;
            const message = mappedError instanceof Error ? mappedError.message : 'WebSocket upgrade failed';

            logger.warn(`Rejected Jupyter websocket upgrade requestUrl=${requestUrl} statusCode=${statusCode}`);

            writeUpgradeError(socket, statusCode, message);
        }
    };
}

export default new ScriptingJupyterProxyService();
