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
        return this.teamClusterDaemonClient.command<RuntimeContainerSummary[]>(teamClusterId, 'container.list');
    }

    async createContainer(teamClusterId: string, config: CreateRuntimeContainerOptions): Promise<RuntimeContainerInfo> {
        return this.teamClusterDaemonClient.command<RuntimeContainerInfo>(teamClusterId, 'container.create', { ...config });
    }

    async getContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo> {
        return this.teamClusterDaemonClient.command<RuntimeContainerInfo>(teamClusterId, 'container.get', { containerId });
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
        await this.teamClusterDaemonClient.command<{ deleted: boolean; }>(teamClusterId, 'container.delete', { containerId });
    }

    async getStats(teamClusterId: string, containerId: string): Promise<ContainerStats> {
        return this.teamClusterDaemonClient.command<ContainerStats>(teamClusterId, 'container.stats.get', { containerId });
    }

    async getFiles(teamClusterId: string, containerId: string, path: string): Promise<ContainerFileEntry[]> {
        return this.teamClusterDaemonClient.command<ContainerFileEntry[]>(teamClusterId, 'container.files.list', { containerId, path });
    }

    async readFile(teamClusterId: string, containerId: string, path: string): Promise<string> {
        const response = await this.teamClusterDaemonClient.command<ReadContainerFileResponse>(teamClusterId, 'container.file.read', { containerId, path });

        return response.contents;
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterDaemonClient.attachTerminal(teamClusterId, containerId);
    }

    async getProcesses(teamClusterId: string, containerId: string): Promise<ContainerProcessInfo[]> {
        return this.teamClusterDaemonClient.command<ContainerProcessInfo[]>(teamClusterId, 'container.processes.list', { containerId });
    }

    private async applyContainerAction(teamClusterId: string, containerId: string, action: ContainerRuntimeAction): Promise<RuntimeContainerInfo> {
        return this.teamClusterDaemonClient.command<RuntimeContainerInfo>(teamClusterId, 'container.update', { containerId, action });
    }
};
