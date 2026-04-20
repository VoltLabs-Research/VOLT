import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import { TeamClusterDaemonResponseType, TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { getHttpRequestContext } from '@shared/infrastructure/http/request-context';
import logger from '@shared/infrastructure/logger';
import { isRecord } from '@shared/infrastructure/utilities/type-guards';
import { inject, injectable } from 'tsyringe';
import type { Readable } from 'node:stream';
import type { TeamClusterTunnelOpenRequest } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import type { TeamClusterTunnelStream } from '@modules/team-cluster/utilities/TeamClusterReverseTunnelStream';
import type { ContainerTerminalAttachment } from '@modules/container/domain/port/IContainerService';

interface TeamClusterDaemonResponseEnvelope<T> {
    status: 'success';
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

const isSemanticPayload = (value: unknown): value is TeamClusterDaemonSemanticPayload => {
    return isRecord(value);
};

/**
 * The SDK's ReverseChannelBridge wraps every successful command response in
 * `{status: 'success', data: result.data}` before sending it over the wire.
 * Unwrap that inner envelope so callers see the raw result directly.
 */
const unwrapResponseEnvelopeData = (value: unknown): unknown => {
    if (!isRecord(value) || value.status !== 'success' || !('data' in value)) {
        return value;
    }

    return (value as unknown as TeamClusterDaemonResponseEnvelope<unknown>).data;
};

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

const readPayloadBytes = (payload?: Record<string, unknown>): number | undefined => {
    if (!payload) {
        return undefined;
    }

    try {
        return Buffer.byteLength(JSON.stringify(payload), 'utf8');
    } catch {
        return undefined;
    }
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

        return {
            traceId: requestContext?.traceId,
            teamClusterId,
            command,
            responseType,
            payloadBytes: readPayloadBytes(payload),
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

        logger.warn(`logLabel command=${command} status=${response.status} code=${errorCode} message=${errorMessage}`);

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

            if (!response.ok) {
                this.throwDaemonError(command, response, 'Daemon command returned a failure response');
            }

            const data = unwrapResponseEnvelopeData(response.data);

            if (isDaemonErrorPayload(data)) {
                this.throwDaemonError(command, {
                    ok: false,
                    status: response.status,
                    message: response.message,
                    data
                }, 'Daemon command returned an error payload');
            }

            if (response.status >= 400) {
                this.throwDaemonError(command, {
                    ok: false,
                    status: response.status,
                    message: response.message,
                    data
                }, 'Daemon command returned an error status');
            }

            logger.info(`@team-cluster-daemon: response status=${response.status} durationMs=${Date.now() - startedAt}`);

            return data as T;
        } catch (error) {
            logger.warn(`@team-cluster-daemon: failed durationMs=${Date.now() - startedAt}`);
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
        return this.command<TeamClusterDaemonNotebookRuntimeLookupResponse>(teamClusterId, ChannelCommands.NotebookRuntimeGet, {
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
            logger.info(`@team-cluster-daemon: stream-ready durationMs=${Date.now() - startedAt}`);

            return stream;
        }).catch((error: unknown) => {
            logger.warn(`@team-cluster-daemon: stream-failed durationMs=${Date.now() - startedAt}`);
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
            logger.info(`@team-cluster-daemon: response-stream-ready durationMs=${Date.now() - startedAt} status=${attachment.status}`);

            return attachment;
        }).catch((error: unknown) => {
            logger.warn(`@team-cluster-daemon: response-stream-failed durationMs=${Date.now() - startedAt}`);
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

            logger.info(`@team-cluster-daemon: buffer-response status=${response.status} durationMs=${Date.now() - startedAt}`);

            return Buffer.from(response.bodyBase64, 'base64');
        } catch (error) {
            logger.warn(`@team-cluster-daemon: buffer-failed durationMs=${Date.now() - startedAt}`);
            throw error;
        }
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterReverseChannelService.attachTerminal(teamClusterId, containerId);
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
    ): Promise<TeamClusterTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        request: TeamClusterTunnelOpenRequest
    ): Promise<TeamClusterTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        target: string | TeamClusterTunnelOpenRequest,
        accessMode?: TeamClusterServiceExposureAccessMode
    ): Promise<TeamClusterTunnelStream> {
        if (typeof target === 'string') {
            if (accessMode === undefined) {
                throw ApplicationError.internalServerError('Tunnel access mode is required for exposure tunnel requests');
            }

            return this.teamClusterReverseChannelService.openTunnel(teamClusterId, target, accessMode);
        }

        return this.teamClusterReverseChannelService.openTunnel(teamClusterId, target);
    }
};
