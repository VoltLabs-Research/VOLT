import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import { TeamClusterDaemonResponseType, TeamClusterServiceExposureAccessMode } from '@modules/team-cluster/utilities/teamClusterSocket';
import { TeamClusterReverseTunnelStream } from '@modules/team-cluster/utilities/TeamClusterReverseTunnelStream';
import { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import logger from '@shared/infrastructure/logger';
import { inject, injectable } from 'tsyringe';
import type { Readable } from 'node:stream';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import type { ContainerTerminalAttachment } from '@modules/container/domain/port/IContainerService';

interface TeamClusterDaemonResponseEnvelope<T> {
    status: string;
    data: T;
    message?: string;
};

/** Structured error payload emitted by the daemon's `adaptHandler` catch block. */
interface DaemonErrorPayload {
    status: 'error';
    code: string;
    message: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isResponseEnvelope = <T>(value: unknown): value is TeamClusterDaemonResponseEnvelope<T> => {
    return isRecord(value) && typeof value.status === 'string' && 'data' in value;
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
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService)
        private readonly teamClusterReverseChannelService: TeamClusterReverseChannelService
    ) {}

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

    async command<T>(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<T> {
        const response = await this.teamClusterReverseChannelService.command(teamClusterId, {
            command,
            payload,
            responseType: TeamClusterDaemonResponseType.Json
        });

        if (!response.ok || !isResponseEnvelope<T>(response.data)) {
            this.throwDaemonError(command, response, 'Daemon command returned a failure response');
        }

        return response.data.data;
    }

    async commandStream(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<Readable> {
        return this.teamClusterReverseChannelService.openStream(teamClusterId, {
            command,
            payload,
            responseType: TeamClusterDaemonResponseType.Stream
        });
    }

    async commandResponseStream(
        teamClusterId: string,
        command: string,
        payload?: Record<string, unknown>
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        return this.teamClusterReverseChannelService.openCommandStream(teamClusterId, {
            command,
            payload,
            responseType: TeamClusterDaemonResponseType.Stream
        });
    }

    async commandBuffer(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<Buffer> {
        const response = await this.teamClusterReverseChannelService.command(teamClusterId, {
            command,
            payload,
            responseType: TeamClusterDaemonResponseType.Buffer
        });

        if (!response.ok) {
            this.throwDaemonError(command, response, 'Daemon buffer command returned a failure response');
        }

        if (!response.bodyBase64) {
            throw ApplicationError.internalServerError('Daemon buffer response body is empty');
        }

        return Buffer.from(response.bodyBase64, 'base64');
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterReverseChannelService.attachTerminal(teamClusterId, containerId);
    }

    async attachHostTerminal(teamClusterId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterReverseChannelService.attachHostTerminal(teamClusterId);
    }

    async attachWebSocket(teamClusterId: string, targetUrl: string): Promise<TeamClusterReverseWebSocketStream> {
        return this.teamClusterReverseChannelService.attachWebSocket(teamClusterId, targetUrl);
    }

    async openTunnel(
        teamClusterId: string,
        exposureId: string,
        accessMode: TeamClusterServiceExposureAccessMode
    ): Promise<TeamClusterReverseTunnelStream> {
        return this.teamClusterReverseChannelService.openTunnel(teamClusterId, exposureId, accessMode);
    }
};
