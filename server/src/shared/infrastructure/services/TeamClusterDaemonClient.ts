import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import { TeamClusterDaemonResponseType, TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import { TeamClusterReverseTunnelStream } from '@modules/team-cluster/utilities/TeamClusterReverseTunnelStream';
import { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@shared/infrastructure/contracts/team-cluster';
import { getHttpRequestContext } from '@shared/infrastructure/http/request-context';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { Readable } from 'node:stream';
import type { TeamClusterTunnelOpenRequest } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import type { ContainerTerminalAttachment } from '@modules/container/domain/port/IContainerService';

interface TeamClusterDaemonResponseEnvelope<T> {
    status: string;
    data: T;
    message?: string;
};

interface TeamClusterDaemonSemanticPayload {
    accepted?: boolean;
    reason?: string;
    message?: string;
};

export interface TeamClusterDaemonCommandOptions {
    timeoutMs?: number;
    timeoutClass?: 'default' | 'interactive' | 'long-running-control-plane';
    retryClass?: 'none' | 'safe-read' | 'idempotent-command';
}

export interface TeamClusterDaemonSemanticCommandResult<T> {
    accepted: boolean;
    data: T;
    reason?: string;
    retryClass: NonNullable<TeamClusterDaemonCommandOptions['retryClass']>;
    timeoutClass: NonNullable<TeamClusterDaemonCommandOptions['timeoutClass']>;
}

export interface TeamClusterDaemonNotebookRuntime {
    tunnelTargetHost: string;
    tunnelTargetPort: number;
};

export interface TeamClusterDaemonNotebookRuntimeLookupResponse {
    runtime: TeamClusterDaemonNotebookRuntime | null;
};

/** Structured error payload emitted by the daemon's `adaptHandler` catch block. */
interface DaemonErrorPayload {
    status: 'error';
    code: string;
    message: string;
};

interface DaemonCommandMetadata {
    traceId?: string;
    requestMethod?: string;
    requestPath?: string;
};

interface DaemonDispatchLogContext {
    traceId?: string;
    teamClusterId: string;
    command: string;
    responseType: TeamClusterDaemonResponseType;
    payloadBytes?: number;
    timeoutMs?: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isResponseEnvelope = <T>(value: unknown): value is TeamClusterDaemonResponseEnvelope<T> => {
    return isRecord(value) && typeof value.status === 'string' && 'data' in value;
};

const isSemanticPayload = (value: unknown): value is TeamClusterDaemonSemanticPayload => {
    return isRecord(value);
};

// TODO: THIS IS UGLY, VOLTSDK EXISTS FOR AVOID THIS

const isDaemonErrorPayload = (value: unknown): value is DaemonErrorPayload => {
    return (
        isRecord(value) &&
        value.status === 'error' &&
        typeof value.code === 'string' &&
        typeof value.message === 'string'
    );
};

/**
 * Maps a daemon HTTP status code to an `ApplicationError` with the correct status class.
 * 4xx daemon errors are treated as operational client errors; 5xx as operational server errors.
 * The daemon's error code and message are always preserved for observability.
 */
const mapDaemonStatusToApplicationError = (
    status: number,
    code: string,
    message: string
): ApplicationError => {
    if (status === 401) return ApplicationError.unauthorized(code, message);
    if (status === 403) return ApplicationError.forbidden(code, message);
    if (status === 404) return ApplicationError.notFound(code, message);
    if (status === 409) return ApplicationError.conflict(code, message);
    if (status >= 400 && status < 500) return new ApplicationError(code, message, status);
    return new ApplicationError(code, message, 500);
};

@injectable()
export default class TeamClusterDaemonClient {
    private static readonly TIMEOUT_BY_CLASS: Record<NonNullable<TeamClusterDaemonCommandOptions['timeoutClass']>, number> = {
        default: 30_000,
        interactive: 10_000,
        'long-running-control-plane': 60_000
    };

    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService)
        private readonly teamClusterReverseChannelService: TeamClusterReverseChannelService
    ) {}

    private createCommandMetadata(): DaemonCommandMetadata {
        const requestContext = getHttpRequestContext();

        return {
            traceId: requestContext?.traceId,
            requestMethod: requestContext?.method,
            requestPath: requestContext?.path
        };
    }

    private buildPayloadWithMetadata(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
        const metadata = this.createCommandMetadata();
        const hasMetadata = Boolean(metadata.traceId || metadata.requestMethod || metadata.requestPath);

        if (!payload && !hasMetadata) {
            return undefined;
        }

        const payloadMetadata = isRecord(payload?.metadata)
            ? payload.metadata
            : {};

        return {
            ...(payload || {}),
            metadata: {
                ...payloadMetadata,
                ...metadata
            }
        };
    }

    private createDispatchLogContext(
        teamClusterId: string,
        command: string,
        responseType: TeamClusterDaemonResponseType,
        payload?: Record<string, unknown>,
        timeoutMs?: number
    ): DaemonDispatchLogContext {
        const requestContext = getHttpRequestContext();
        const payloadBytes = payload
            ? Buffer.byteLength(JSON.stringify(payload), 'utf8')
            : undefined;

        return {
            traceId: requestContext?.traceId,
            teamClusterId,
            command,
            responseType,
            payloadBytes,
            timeoutMs
        };
    }

    private resolveCommandOptions(options?: TeamClusterDaemonCommandOptions): Required<TeamClusterDaemonCommandOptions> {
        const timeoutClass = options?.timeoutClass ?? 'default';
        return {
            timeoutMs: options?.timeoutMs ?? TeamClusterDaemonClient.TIMEOUT_BY_CLASS[timeoutClass],
            timeoutClass,
            retryClass: options?.retryClass ?? 'none'
        };
    }

    /**
     * Extracts the error code and message from a daemon response, logs a warning,
     * and throws the appropriate `ApplicationError`.
     *
     * @param command - The command name, used in the fallback message and log.
     * @param response - The raw daemon response envelope.
     * @param logLabel - Human-readable label used in the warning log entry.
     */
    private throwDaemonError(
        command: string,
        response: { ok: boolean; status: number; message?: string; data?: unknown },
        logLabel: string
    ): never {
        const errorCode = isDaemonErrorPayload(response.data)
            ? response.data.code
            : 'TeamCluster::DaemonRequestFailed';
        const errorMessage = isDaemonErrorPayload(response.data)
            ? response.data.message
            : (response.message || `Daemon command "${command}" failed with status ${response.status}`);

        logger.warn(
            { command, status: response.status, code: errorCode, message: errorMessage },
            logLabel
        );

        throw mapDaemonStatusToApplicationError(response.status, errorCode, errorMessage);
    }

    async command<T>(teamClusterId: string, command: string, payload?: Record<string, unknown>, options?: TeamClusterDaemonCommandOptions): Promise<T> {
        const resolvedOptions = this.resolveCommandOptions(options);
        const payloadWithMetadata = this.buildPayloadWithMetadata(payload);
        const dispatchContext = this.createDispatchLogContext(
            teamClusterId,
            command,
            TeamClusterDaemonResponseType.Json,
            payloadWithMetadata,
            resolvedOptions.timeoutMs
        );
        const startedAt = Date.now();

        logger.info(dispatchContext, '@team-cluster-daemon: dispatch');

        try {
            const response = await this.teamClusterReverseChannelService.command(teamClusterId, {
                command,
                payload: payloadWithMetadata,
                responseType: TeamClusterDaemonResponseType.Json
            }, {
                timeoutMs: resolvedOptions.timeoutMs
            });

            if (!response.ok || !isResponseEnvelope<T>(response.data)) {
                this.throwDaemonError(command, response, 'Daemon command returned a failure response');
            }

            logger.info({
                ...dispatchContext,
                status: response.status,
                durationMs: Date.now() - startedAt
            }, '@team-cluster-daemon: response');

            return response.data.data;
        } catch (error) {
            logger.warn({
                ...dispatchContext,
                durationMs: Date.now() - startedAt,
                err: error
            }, '@team-cluster-daemon: failed');
            throw error;
        }
    }

    async commandWithSemanticResult<T>(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>,
        options?: TeamClusterDaemonCommandOptions
    ): Promise<TeamClusterDaemonSemanticCommandResult<T>> {
        const resolvedOptions = this.resolveCommandOptions(options);
        const data = await this.command<T>(teamClusterId, command, payload, resolvedOptions);
        const semanticPayload = isSemanticPayload(data) ? data : null;
        const accepted = semanticPayload?.accepted !== false;

        return {
            accepted,
            data,
            reason: typeof semanticPayload?.reason === 'string'
                ? semanticPayload.reason
                : typeof semanticPayload?.message === 'string'
                    ? semanticPayload.message
                    : undefined,
            retryClass: resolvedOptions.retryClass,
            timeoutClass: resolvedOptions.timeoutClass
        };
    }

    async getNotebookRuntime(
        teamClusterId: string,
        notebookId: string
    ): Promise<TeamClusterDaemonNotebookRuntimeLookupResponse> {
        return this.command<TeamClusterDaemonNotebookRuntimeLookupResponse>(teamClusterId, TEAM_CLUSTER_DAEMON_COMMAND.notebook.runtime.get, {
            notebookId
        });
    }

    async commandStream(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<Readable> {
        const payloadWithMetadata = this.buildPayloadWithMetadata(payload);
        const dispatchContext = this.createDispatchLogContext(
            teamClusterId,
            command,
            TeamClusterDaemonResponseType.Stream,
            payloadWithMetadata
        );
        const startedAt = Date.now();

        logger.info(dispatchContext, '@team-cluster-daemon: stream-dispatch');

        return this.teamClusterReverseChannelService.openStream(teamClusterId, {
            command,
            payload: payloadWithMetadata,
            responseType: TeamClusterDaemonResponseType.Stream
        }).then((stream) => {
            logger.info({
                ...dispatchContext,
                durationMs: Date.now() - startedAt
            }, '@team-cluster-daemon: stream-ready');

            return stream;
        }).catch((error: unknown) => {
            logger.warn({
                ...dispatchContext,
                durationMs: Date.now() - startedAt,
                err: error
            }, '@team-cluster-daemon: stream-failed');
            throw error;
        });
    }

    async commandResponseStream(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        const payloadWithMetadata = this.buildPayloadWithMetadata(payload);
        const dispatchContext = this.createDispatchLogContext(
            teamClusterId,
            command,
            TeamClusterDaemonResponseType.Stream,
            payloadWithMetadata
        );
        const startedAt = Date.now();

        logger.info(dispatchContext, '@team-cluster-daemon: response-stream-dispatch');

        return this.teamClusterReverseChannelService.openCommandStream(teamClusterId, {
            command,
            payload: payloadWithMetadata,
            responseType: TeamClusterDaemonResponseType.Stream
        }).then((attachment) => {
            logger.info({
                ...dispatchContext,
                durationMs: Date.now() - startedAt,
                status: attachment.status
            }, '@team-cluster-daemon: response-stream-ready');

            return attachment;
        }).catch((error: unknown) => {
            logger.warn({
                ...dispatchContext,
                durationMs: Date.now() - startedAt,
                err: error
            }, '@team-cluster-daemon: response-stream-failed');
            throw error;
        });
    }

    async commandBuffer(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<Buffer> {
        const payloadWithMetadata = this.buildPayloadWithMetadata(payload);
        const dispatchContext = this.createDispatchLogContext(
            teamClusterId,
            command,
            TeamClusterDaemonResponseType.Buffer,
            payloadWithMetadata
        );
        const startedAt = Date.now();

        logger.info(dispatchContext, '@team-cluster-daemon: buffer-dispatch');

        try {
            const response = await this.teamClusterReverseChannelService.command(teamClusterId, {
                command,
                payload: payloadWithMetadata,
                responseType: TeamClusterDaemonResponseType.Buffer
            });

            if (!response.ok) {
                this.throwDaemonError(command, response, 'Daemon buffer command returned a failure response');
            }

            if (!response.bodyBase64) {
                throw ApplicationError.internalServerError('Daemon buffer response body is empty');
            }

            logger.info({
                ...dispatchContext,
                status: response.status,
                durationMs: Date.now() - startedAt
            }, '@team-cluster-daemon: buffer-response');

            return Buffer.from(response.bodyBase64, 'base64');
        } catch (error) {
            logger.warn({
                ...dispatchContext,
                durationMs: Date.now() - startedAt,
                err: error
            }, '@team-cluster-daemon: buffer-failed');
            throw error;
        }
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterReverseChannelService.attachTerminal(teamClusterId, containerId);
    }

    async attachHostTerminal(teamClusterId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterReverseChannelService.attachHostTerminal(teamClusterId);
    }

    async attachWebSocket(
        teamClusterId: string,
        targetUrl: string,
        protocols?: string[]
    ): Promise<TeamClusterReverseWebSocketStream> {
        return this.teamClusterReverseChannelService.attachWebSocket(teamClusterId, targetUrl, protocols);
    }

    async openTunnel(
        teamClusterId: string,
        exposureId: string,
        accessMode: TeamClusterServiceExposureAccessMode
    ): Promise<TeamClusterReverseTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        request: TeamClusterTunnelOpenRequest
    ): Promise<TeamClusterReverseTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        target: string | TeamClusterTunnelOpenRequest,
        accessMode?: TeamClusterServiceExposureAccessMode
    ): Promise<TeamClusterReverseTunnelStream> {
        if (typeof target === 'string') {
            if (accessMode === undefined) {
                throw ApplicationError.internalServerError('Tunnel access mode is required for exposure tunnel requests');
            }

            return this.teamClusterReverseChannelService.openTunnel(teamClusterId, target, accessMode);
        }

        return this.teamClusterReverseChannelService.openTunnel(teamClusterId, target);
    }
};
