import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import {
    TeamClusterDaemonResponseType,
    type TeamClusterDaemonSocketResponsePayload
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { inject, injectable } from 'tsyringe';
import type { Readable } from 'node:stream';
import type { TeamClusterDaemonSocketHeaders } from '@modules/team-cluster/utilities/teamClusterSocket';
import type { TeamClusterReverseChannelStreamAttachment } from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import type { ContainerTerminalAttachment } from '@modules/container/domain/port/IContainerService';

interface TeamClusterDaemonRequestOptions {
    method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
    query?: Record<string, string | number | boolean | undefined>;
    headers?: TeamClusterDaemonSocketHeaders;
    targetUrl?: string;
    body?: Record<string, unknown>;
};

interface TeamClusterDaemonResponseEnvelope<T> {
    status: string;
    data: T;
    message?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isTeamClusterDaemonResponseEnvelope = <T>(value: unknown): value is TeamClusterDaemonResponseEnvelope<T> => {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.status === 'string' && 'data' in value;
};

@injectable()
export default class TeamClusterDaemonClient {
    constructor(
        @inject(TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService)
        private readonly teamClusterReverseChannelService: TeamClusterReverseChannelService
    ) {}

    async request<T>(teamClusterId: string, path: string, options: TeamClusterDaemonRequestOptions = {}): Promise<T> {
        const payload = await this.teamClusterReverseChannelService.request(teamClusterId, {
            method: options.method || 'GET',
            path,
            query: options.query,
            body: options.body,
            responseType: TeamClusterDaemonResponseType.Json
        });

        if (!payload.ok || !isTeamClusterDaemonResponseEnvelope<T>(payload.data)) {
            throw ApplicationError.badRequest(
                'TeamCluster::DaemonRequestFailed',
                payload.message || `Daemon request failed with status ${payload.status}`
            );
        }

        return payload.data.data;
    }

    async stream(teamClusterId: string, path: string, options: TeamClusterDaemonRequestOptions = {}): Promise<Readable> {
        return this.teamClusterReverseChannelService.openStream(teamClusterId, {
            method: options.method || 'GET',
            path,
            headers: options.headers,
            targetUrl: options.targetUrl,
            query: options.query,
            body: options.body,
            responseType: TeamClusterDaemonResponseType.Stream
        });
    }

    async openHttpStream(
        teamClusterId: string,
        path: string,
        options: TeamClusterDaemonRequestOptions = {}
    ): Promise<TeamClusterReverseChannelStreamAttachment> {
        return this.teamClusterReverseChannelService.openHttpStream(teamClusterId, {
            method: options.method || 'GET',
            path,
            headers: options.headers,
            targetUrl: options.targetUrl,
            query: options.query,
            body: options.body,
            responseType: TeamClusterDaemonResponseType.Stream
        });
    }

    async requestBuffer(teamClusterId: string, path: string, options: TeamClusterDaemonRequestOptions = {}): Promise<Buffer> {
        const payload = await this.teamClusterReverseChannelService.request(teamClusterId, {
            method: options.method || 'GET',
            path,
            query: options.query,
            body: options.body,
            responseType: TeamClusterDaemonResponseType.Buffer
        });

        if (!payload.ok) {
            throw ApplicationError.badRequest(
                'TeamCluster::DaemonRequestFailed',
                payload.message || `Daemon request failed with status ${payload.status}`
            );
        }

        if (!payload.bodyBase64) {
            throw ApplicationError.internalServerError('Daemon buffer response body is empty');
        }

        return Buffer.from(payload.bodyBase64, 'base64');
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterReverseChannelService.attachTerminal(teamClusterId, containerId);
    }

    async attachWebSocket(teamClusterId: string, targetUrl: string): Promise<TeamClusterReverseWebSocketStream> {
        return this.teamClusterReverseChannelService.attachWebSocket(teamClusterId, targetUrl);
    }
};
