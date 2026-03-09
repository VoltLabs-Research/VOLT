import { TEAM_CLUSTER_TOKENS } from '@modules/team-cluster/infrastructure/di/TeamClusterTokens';
import TeamClusterReverseChannelService from '@modules/team-cluster/infrastructure/services/TeamClusterReverseChannelService';
import {
    TeamClusterDaemonResponseType,
    type TeamClusterDaemonSocketResponsePayload
} from '@modules/team-cluster/utilities/teamClusterSocket';
import { TeamClusterReverseWebSocketStream } from '@modules/team-cluster/utilities/teamClusterReverseWebSocket';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import TeamClusterServiceResolver from '@shared/infrastructure/services/TeamClusterServiceResolver';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
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
        @inject(SHARED_TOKENS.TeamClusterServiceResolver)
        private readonly teamClusterServiceResolver: TeamClusterServiceResolver,

        @inject(TEAM_CLUSTER_TOKENS.TeamClusterReverseChannelService)
        private readonly teamClusterReverseChannelService: TeamClusterReverseChannelService
    ) {}

    async request<T>(teamClusterId: string, path: string, options: TeamClusterDaemonRequestOptions = {}): Promise<T> {
        const resolvedServices = await this.teamClusterServiceResolver.resolve(teamClusterId);
        const payload = await this.teamClusterReverseChannelService.request(resolvedServices.daemon.teamClusterId, {
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
        const resolvedServices = await this.teamClusterServiceResolver.resolve(teamClusterId);

        return this.teamClusterReverseChannelService.openStream(resolvedServices.daemon.teamClusterId, {
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
        const resolvedServices = await this.teamClusterServiceResolver.resolve(teamClusterId);

        return this.teamClusterReverseChannelService.openHttpStream(resolvedServices.daemon.teamClusterId, {
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
        const resolvedServices = await this.teamClusterServiceResolver.resolve(teamClusterId);
        const payload = await this.teamClusterReverseChannelService.request(resolvedServices.daemon.teamClusterId, {
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
        const resolvedServices = await this.teamClusterServiceResolver.resolve(teamClusterId);
        return this.teamClusterReverseChannelService.attachTerminal(resolvedServices.daemon.teamClusterId, containerId);
    }

    async attachWebSocket(teamClusterId: string, targetUrl: string): Promise<TeamClusterReverseWebSocketStream> {
        const resolvedServices = await this.teamClusterServiceResolver.resolve(teamClusterId);
        return this.teamClusterReverseChannelService.attachWebSocket(resolvedServices.daemon.teamClusterId, targetUrl);
    }
};
