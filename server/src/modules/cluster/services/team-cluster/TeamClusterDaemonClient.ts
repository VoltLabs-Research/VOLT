import { ErrorCodes, toErrorCode } from '@core/constants/error-codes';
import type { ContainerTerminalAttachment } from '@shared/contracts/ports/IContainerService';
import teamClusterReverseChannelService from '@modules/cluster/services/reverse-channel/TeamClusterReverseChannelService';
import type {
    TeamClusterReverseChannelStreamAttachment,
    TeamClusterTunnelOpenOptions,
    TeamClusterTunnelOpenRequest
} from '@modules/cluster/services/reverse-channel/reverse-channel-protocol';
import type { TeamClusterReverseTunnelStream } from '@modules/cluster/services/reverse-channel/TeamClusterReverseTunnelStream';
import type { TeamClusterServiceExposureAccessMode } from '@shared/contracts/types/TeamClusterExposure';
import { TeamClusterDaemonResponseType } from '@shared/contracts/types/TeamClusterDaemon';
import type {
    TeamClusterDaemonErrorResult,
    TeamClusterDaemonSocketResponsePayload
} from '@modules/cluster/socket/TeamClusterSocketProtocol';
import type {
    TeamClusterDaemonCommandOptions,
    TeamClusterDaemonSemanticCommandResult
} from '@shared/domain/port/ITeamClusterDaemonClient';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import { getHttpRequestContext } from '@shared/infrastructure/http/request-context';
import logger from '@shared/infrastructure/logger';
import type { Readable } from 'node:stream';

export type { TeamClusterDaemonSemanticCommandResult };

interface TeamClusterDaemonSemanticPayload {
    accepted?: boolean;
    reason?: string;
    message?: string;
}

const TIMEOUT_BY_CLASS: Record<NonNullable<TeamClusterDaemonCommandOptions['timeoutClass']>, number> = {
    default: 30_000,
    interactive: 10_000,
    'long-running-control-plane': 60_000
};

/**
 * A daemon handler can answer with an error report inside the success envelope,
 * which is a declared member of the envelope payload union.
 */
const readDaemonErrorResult = (data: unknown): TeamClusterDaemonErrorResult | null => {
    const candidate = data as TeamClusterDaemonErrorResult | null;
    return candidate?.status === 'error' ? candidate : null;
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

class TeamClusterDaemonClient {
    private buildPayloadWithMetadata(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
        const requestContext = getHttpRequestContext();
        if (!payload && !requestContext) {
            return undefined;
        }

        return {
            ...(payload || {}),
            metadata: {
                ...(payload?.metadata as Record<string, unknown> | undefined),
                traceId: requestContext?.traceId,
                requestMethod: requestContext?.method,
                requestPath: requestContext?.path
            }
        };
    }

    /**
     * Logs one dispatch/outcome pair around a reverse channel call so every verb
     * reports the same shape without repeating the timing plumbing.
     */
    private async dispatch<T>(
        label: string,
        teamClusterId: string,
        command: string,
        responseType: TeamClusterDaemonResponseType,
        payload: Record<string, unknown> | undefined,
        timeoutMs: number | undefined,
        run: () => Promise<T>,
        describeOutcome: (value: T) => string
    ): Promise<T> {
        logger.info({
            traceId: getHttpRequestContext()?.traceId,
            teamClusterId,
            command,
            responseType,
            payloadBytes: command === ChannelCommands.AnalysisStart ? undefined : readPayloadBytes(payload),
            timeoutMs
        }, `@team-cluster-daemon: ${label}-dispatch`);

        const startedAt = Date.now();
        try {
            const value = await run();
            logger.info(`@team-cluster-daemon: ${label}-response ${describeOutcome(value)} durationMs=${Date.now() - startedAt}`);
            return value;
        } catch (error: unknown) {
            logger.warn(`@team-cluster-daemon: ${label}-failed durationMs=${Date.now() - startedAt}`);
            throw error;
        }
    }

    private throwDaemonError(
        command: string,
        status: number,
        message: string | undefined,
        errorResult: TeamClusterDaemonErrorResult | null,
        logLabel: string
    ): never {
        const code = toErrorCode(errorResult?.code, ErrorCodes.TEAM_CLUSTER_DAEMON_REQUEST_FAILED);
        const errorMessage = errorResult?.message
            ?? message
            ?? `Daemon command "${command}" failed with status ${status}`;

        logger.warn(`${logLabel} command=${command} status=${status} code=${code} message=${errorMessage}`);

        throw new ApplicationError(code, errorMessage, status >= 400 && status < 500 ? status : 500);
    }

    private unwrap<T>(command: string, response: TeamClusterDaemonSocketResponsePayload, logLabel: string): T {
        if (!response.ok) {
            this.throwDaemonError(command, response.status, response.message, readDaemonErrorResult(response.data?.data), logLabel);
        }

        const data = response.data?.data;
        const errorResult = readDaemonErrorResult(data);
        if (errorResult || response.status >= 400) {
            this.throwDaemonError(command, response.status, response.message, errorResult, logLabel);
        }

        return data as T;
    }

    async command<T>(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>,
        options?: TeamClusterDaemonCommandOptions
    ): Promise<T> {
        const timeoutMs = options?.timeoutMs ?? TIMEOUT_BY_CLASS[options?.timeoutClass ?? 'default'];
        const payloadWithMetadata = this.buildPayloadWithMetadata(payload);

        return this.dispatch(
            'command',
            teamClusterId,
            command,
            TeamClusterDaemonResponseType.Json,
            payloadWithMetadata,
            timeoutMs,
            async () => {
                const response = await teamClusterReverseChannelService.command(teamClusterId, {
                    command,
                    payload: payloadWithMetadata,
                    responseType: TeamClusterDaemonResponseType.Json
                }, { timeoutMs });

                return this.unwrap<T>(command, response, 'Daemon command failed');
            },
            () => 'ok'
        );
    }

    async commandWithSemanticResult<T>(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>,
        options?: TeamClusterDaemonCommandOptions
    ): Promise<TeamClusterDaemonSemanticCommandResult<T>> {
        const timeoutClass = options?.timeoutClass ?? 'default';
        const retryClass = options?.retryClass ?? 'none';
        const data = await this.command<T>(teamClusterId, command, payload, {
            ...options,
            timeoutClass
        });
        const semanticPayload = data as TeamClusterDaemonSemanticPayload | null;

        return {
            accepted: semanticPayload?.accepted !== false,
            data,
            reason: semanticPayload?.reason ?? semanticPayload?.message,
            retryClass,
            timeoutClass
        };
    }

    async commandStream(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<Readable> {
        const payloadWithMetadata = this.buildPayloadWithMetadata(payload);

        return this.dispatch(
            'stream',
            teamClusterId,
            command,
            TeamClusterDaemonResponseType.Stream,
            payloadWithMetadata,
            undefined,
            async () => (await teamClusterReverseChannelService.openCommandStream(teamClusterId, {
                command,
                payload: payloadWithMetadata,
                responseType: TeamClusterDaemonResponseType.Stream
            })).stream,
            () => 'ready'
        );
    }

    async commandResponseStream(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        const payloadWithMetadata = this.buildPayloadWithMetadata(payload);

        return this.dispatch(
            'response-stream',
            teamClusterId,
            command,
            TeamClusterDaemonResponseType.Stream,
            payloadWithMetadata,
            undefined,
            () => teamClusterReverseChannelService.openCommandStream(teamClusterId, {
                command,
                payload: payloadWithMetadata,
                responseType: TeamClusterDaemonResponseType.Stream
            }),
            (attachment) => `status=${attachment.status}`
        );
    }

    async commandBuffer(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<Buffer> {
        const payloadWithMetadata = this.buildPayloadWithMetadata(payload);

        return this.dispatch(
            'buffer',
            teamClusterId,
            command,
            TeamClusterDaemonResponseType.Buffer,
            payloadWithMetadata,
            undefined,
            async () => {
                const response = await teamClusterReverseChannelService.command(teamClusterId, {
                    command,
                    payload: payloadWithMetadata,
                    responseType: TeamClusterDaemonResponseType.Buffer
                });
                const { body } = this.unwrap<{ body?: Uint8Array }>(command, response, 'Daemon buffer command failed');

                if (!body) {
                    throw ApplicationError.internalServerError('Daemon buffer response body is empty');
                }

                return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
            },
            (body) => `bytes=${body.byteLength}`
        );
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return teamClusterReverseChannelService.attachTerminal(teamClusterId, containerId);
    }

    async openTunnel(
        teamClusterId: string,
        exposureId: string,
        accessMode: TeamClusterServiceExposureAccessMode,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterReverseTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        request: TeamClusterTunnelOpenRequest,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterReverseTunnelStream>;

    async openTunnel(
        teamClusterId: string,
        target: string | TeamClusterTunnelOpenRequest,
        accessModeOrOptions?: TeamClusterServiceExposureAccessMode | TeamClusterTunnelOpenOptions,
        options?: TeamClusterTunnelOpenOptions
    ): Promise<TeamClusterReverseTunnelStream> {
        if (typeof target !== 'string') {
            return teamClusterReverseChannelService.openTunnel(
                teamClusterId,
                target,
                accessModeOrOptions as TeamClusterTunnelOpenOptions | undefined
            );
        }

        const accessMode = accessModeOrOptions as TeamClusterServiceExposureAccessMode | undefined;
        if (!accessMode) {
            throw ApplicationError.internalServerError('Tunnel access mode is required for exposure tunnel requests');
        }

        return teamClusterReverseChannelService.openTunnel(teamClusterId, {
            exposureId: target,
            accessMode
        }, options);
    }
}

export default new TeamClusterDaemonClient();
