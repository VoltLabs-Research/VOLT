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
import { ChannelCommands } from '@shared/infrastructure/contracts/team-cluster';
import TeamClusterDaemonClient from '@shared/infrastructure/services/TeamClusterDaemonClient';
import { injectable } from 'tsyringe';

type ContainerRuntimeAction = 'start' | 'stop' | 'restart';

interface ReadContainerFileResponse {
    contents: string;
};

const CONTAINER_STATS_CACHE_TTL_MS = 3_000;
const CONTAINER_PROCESSES_CACHE_TTL_MS = 5_000;

@injectable()
export class DaemonContainerRuntimeService implements ITeamClusterContainerRuntimeService {
    private readonly statsCache = new Map<string, {
        expiresAt: number;
        value: ContainerStats;
    }>();
    private readonly processesCache = new Map<string, {
        expiresAt: number;
        value: ContainerProcessInfo[];
    }>();
    private readonly pendingStats = new Map<string, Promise<ContainerStats>>();
    private readonly pendingProcesses = new Map<string, Promise<ContainerProcessInfo[]>>();

    constructor(
        
        private readonly teamClusterDaemonClient: TeamClusterDaemonClient
    ) {}

    async listContainers(teamClusterId: string): Promise<RuntimeContainerSummary[]> {
        return this.teamClusterDaemonClient.command<RuntimeContainerSummary[]>(teamClusterId, ChannelCommands.ContainerList);
    }

    async createContainer(teamClusterId: string, config: CreateRuntimeContainerOptions): Promise<RuntimeContainerInfo> {
        const container = await this.teamClusterDaemonClient.command<RuntimeContainerInfo>(teamClusterId, ChannelCommands.ContainerCreate, { ...config }, {
            timeoutMs: 5 * 60 * 1000
        });
        this.clearContainerCache(teamClusterId, container.Id);
        return container;
    }

    async getContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo> {
        return this.teamClusterDaemonClient.command<RuntimeContainerInfo>(teamClusterId, ChannelCommands.ContainerGet, { containerId });
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
        await this.teamClusterDaemonClient.command<{ deleted: boolean; }>(teamClusterId, ChannelCommands.ContainerDelete, { containerId });
        this.clearContainerCache(teamClusterId, containerId);
    }

    async getStats(teamClusterId: string, containerId: string): Promise<ContainerStats> {
        const cacheKey = this.buildContainerCacheKey(teamClusterId, containerId);
        const cachedStats = this.statsCache.get(cacheKey);
        if (cachedStats && cachedStats.expiresAt > Date.now()) {
            return cachedStats.value;
        }

        const pendingStats = this.pendingStats.get(cacheKey);
        if (pendingStats) {
            return pendingStats;
        }

        const statsPromise = this.teamClusterDaemonClient.command<ContainerStats>(
            teamClusterId,
            ChannelCommands.ContainerStats,
            { containerId }
        ).then((stats) => {
            this.statsCache.set(cacheKey, {
                expiresAt: Date.now() + CONTAINER_STATS_CACHE_TTL_MS,
                value: stats
            });
            return stats;
        }).finally(() => {
            this.pendingStats.delete(cacheKey);
        });

        this.pendingStats.set(cacheKey, statsPromise);
        return statsPromise;
    }

    async getFiles(teamClusterId: string, containerId: string, path: string): Promise<ContainerFileEntry[]> {
        return this.teamClusterDaemonClient.command<ContainerFileEntry[]>(teamClusterId, ChannelCommands.ContainerFilesList, { containerId, path });
    }

    async readFile(teamClusterId: string, containerId: string, path: string): Promise<string> {
        const response = await this.teamClusterDaemonClient.command<ReadContainerFileResponse>(teamClusterId, ChannelCommands.ContainerFileRead, { containerId, path });

        return response.contents;
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return this.teamClusterDaemonClient.attachTerminal(teamClusterId, containerId);
    }

    async getProcesses(teamClusterId: string, containerId: string): Promise<ContainerProcessInfo[]> {
        const cacheKey = this.buildContainerCacheKey(teamClusterId, containerId);
        const cachedProcesses = this.processesCache.get(cacheKey);
        if (cachedProcesses && cachedProcesses.expiresAt > Date.now()) {
            return cachedProcesses.value;
        }

        const pendingProcesses = this.pendingProcesses.get(cacheKey);
        if (pendingProcesses) {
            return pendingProcesses;
        }

        const processesPromise = this.teamClusterDaemonClient.command<ContainerProcessInfo[]>(
            teamClusterId,
            ChannelCommands.ContainerProcessesList,
            { containerId }
        ).then((processes) => {
            this.processesCache.set(cacheKey, {
                expiresAt: Date.now() + CONTAINER_PROCESSES_CACHE_TTL_MS,
                value: processes
            });
            return processes;
        }).finally(() => {
            this.pendingProcesses.delete(cacheKey);
        });

        this.pendingProcesses.set(cacheKey, processesPromise);
        return processesPromise;
    }

    private async applyContainerAction(teamClusterId: string, containerId: string, action: ContainerRuntimeAction): Promise<RuntimeContainerInfo> {
        const container = await this.teamClusterDaemonClient.command<RuntimeContainerInfo>(
            teamClusterId,
            ChannelCommands.ContainerUpdate,
            { containerId, action }
        );
        this.clearContainerCache(teamClusterId, containerId);
        return container;
    }

    private buildContainerCacheKey(teamClusterId: string, containerId: string): string {
        return `${teamClusterId}:${containerId}`;
    }

    private clearContainerCache(teamClusterId: string, containerId: string): void {
        const cacheKey = this.buildContainerCacheKey(teamClusterId, containerId);
        this.statsCache.delete(cacheKey);
        this.processesCache.delete(cacheKey);
        this.pendingStats.delete(cacheKey);
        this.pendingProcesses.delete(cacheKey);
    }
};
