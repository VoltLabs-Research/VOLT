import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import { TeamClusterDaemonResponseType } from '@modules/team-cluster/utilities/teamClusterSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { Readable } from 'node:stream';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import type { ContainerTerminalAttachment } from '@modules/container/domain/port/IContainerService';

interface TeamClusterDaemonResponseEnvelope<T> {
    status: string;
    data: T;
    message?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isResponseEnvelope = <T>(value: unknown): value is TeamClusterDaemonResponseEnvelope<T> => {
    return isRecord(value) && typeof value.status === 'string' && 'data' in value;
};

@injectable()
export default class TeamClusterDaemonClient {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService)
        private readonly teamClusterReverseChannelService: TeamClusterReverseChannelService
    ) {}

    async command<T>(teamClusterId: string, command: string, payload?: Record<string, unknown>): Promise<T> {
        const response = await this.teamClusterReverseChannelService.command(teamClusterId, {
            command,
            payload,
            responseType: TeamClusterDaemonResponseType.Json
        });

        if (!response.ok || !isResponseEnvelope<T>(response.data)) {
            throw ApplicationError.badRequest(
                'TeamCluster::DaemonRequestFailed',
                response.message || `Daemon command failed with status ${response.status}`
            );
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
            throw ApplicationError.badRequest(
                'TeamCluster::DaemonRequestFailed',
                response.message || `Daemon command failed with status ${response.status}`
            );
        }

        if (!response.bodyBase64) {
            throw ApplicationError.internalServerError('Daemon buffer response body is empty');
        }

        return Buffer.from(response.bodyBase64, 'base64');
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterReverseChannelService.attachTerminal(teamClusterId, containerId);
    }

    async attachWebSocket(teamClusterId: string, targetUrl: string): Promise<TeamClusterReverseWebSocketStream> {
        return this.teamClusterReverseChannelService.attachWebSocket(teamClusterId, targetUrl);
    }
};
