import type {
    ContainerFileEntry,
    ContainerProcessInfo,
    ContainerStats,
    ContainerTerminalAttachment,
    CreateRuntimeContainerOptions,
    RuntimeContainerInfo
} from '@modules/container/domain/port/IContainerService';
import type {
    ITeamClusterContainerRuntimeService,
    RuntimeContainerSummary
} from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { inject, injectable } from 'tsyringe';

type ContainerRuntimeAction = 'start' | 'stop' | 'restart';

interface ReadContainerFileResponse {
    contents: string;
};

@injectable()
export class DaemonContainerRuntimeService implements ITeamClusterContainerRuntimeService {
    constructor(
        @inject(SHARED_TOKENS.TeamClusterDaemonClient)
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async listContainers(teamClusterId: string): Promise<RuntimeContainerSummary[]> {
        return this.teamClusterDaemonClient.request<RuntimeContainerSummary[]>(teamClusterId, '/api/containers');
    }

    async createContainer(teamClusterId: string, config: CreateRuntimeContainerOptions): Promise<RuntimeContainerInfo> {
        return this.teamClusterDaemonClient.request<RuntimeContainerInfo>(teamClusterId, '/api/containers', {
            method: 'POST',
            body: { ...config }
        });
    }

    async getContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo> {
        return this.teamClusterDaemonClient.request<RuntimeContainerInfo>(teamClusterId, `/api/containers/${containerId}`);
    }

    async startContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo> {
        return this.applyContainerAction(teamClusterId, containerId, 'start');
    }

    async stopContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo> {
        return this.applyContainerAction(teamClusterId, containerId, 'stop');
    }

    async restartContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo> {
        return this.applyContainerAction(teamClusterId, containerId, 'restart');
    }

    async removeContainer(teamClusterId: string, containerId: string): Promise<void> {
        await this.teamClusterDaemonClient.request<{ deleted: boolean; }>(teamClusterId, `/api/containers/${containerId}`, {
            method: 'DELETE'
        });
    }

    async getStats(teamClusterId: string, containerId: string): Promise<ContainerStats> {
        return this.teamClusterDaemonClient.request<ContainerStats>(teamClusterId, `/api/containers/${containerId}/stats`);
    }

    async getFiles(teamClusterId: string, containerId: string, path: string): Promise<ContainerFileEntry[]> {
        return this.teamClusterDaemonClient.request<ContainerFileEntry[]>(teamClusterId, `/api/containers/${containerId}/files`, {
            query: { path }
        });
    }

    async readFile(teamClusterId: string, containerId: string, path: string): Promise<string> {
        const response = await this.teamClusterDaemonClient.request<ReadContainerFileResponse>(teamClusterId, `/api/containers/${containerId}/file`, {
            query: { path }
        });

        return response.contents;
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterDaemonClient.attachTerminal(teamClusterId, containerId);
    }

    async getProcesses(teamClusterId: string, containerId: string): Promise<ContainerProcessInfo[]> {
        return this.teamClusterDaemonClient.request<ContainerProcessInfo[]>(teamClusterId, `/api/containers/${containerId}/processes`);
    }

    private async applyContainerAction(teamClusterId: string, containerId: string, action: ContainerRuntimeAction): Promise<RuntimeContainerInfo> {
        return this.teamClusterDaemonClient.request<RuntimeContainerInfo>(teamClusterId, `/api/containers/${containerId}`, {
            method: 'PATCH',
            body: { action }
        });
    }
};
