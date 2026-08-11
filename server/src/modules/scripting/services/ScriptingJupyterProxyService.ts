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
import type { TeamClusterServiceExposure } from '@shared/contracts/types';
import ApplicationError from '@shared/application/errors/ApplicationError';
import logger from '@shared/infrastructure/logger';
import { writeUpgradeError } from '@shared/infrastructure/utilities/proxy-relay';
import { buildWebSocketProtocolList } from '@shared/infrastructure/utilities/websocket-protocols';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';

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

const buildUpstreamWebSocketUrl = (requestUrl: string, exposure: TeamClusterServiceExposure): string => {
    const url = new URL(requestUrl, PROXY_URL_ORIGIN);

    url.searchParams.delete(JUPYTER_PROXY_ACCESS_TOKEN_QUERY_PARAM);
    url.searchParams.set(JUPYTER_NATIVE_TOKEN_QUERY_PARAM, jupyterNativeToken);

    const search = url.searchParams.toString();
    return `ws://${exposure.targetHost}:${exposure.targetPort}${url.pathname}${search ? `?${search}` : ''}`;
};

class ScriptingJupyterProxyService {
    isJupyterUpgradeRequest(request: IncomingMessage): boolean {
        return (request.url || '').startsWith(JUPYTER_PROXY_BASE_PATH);
    }

    public handleUpgrade = async (request: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> => {
        const requestUrl = request.url || '';

        try {
            const context = await scriptingJupyterProxyAuthorizer.authorize(requestUrl, request.headers.cookie);
            const exposure = requireNotebookRuntime(context);
            const requestedProtocols = buildWebSocketProtocolList(request.headers['sec-websocket-protocol']);
            const upstreamWebSocketUrl = buildUpstreamWebSocketUrl(requestUrl, exposure);

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
