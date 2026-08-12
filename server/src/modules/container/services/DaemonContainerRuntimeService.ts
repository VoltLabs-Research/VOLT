import teamClusterDaemonClient from '@modules/cluster/services/team-cluster/TeamClusterDaemonClient';
import type {
    ContainerFileEntry,
    ContainerProcessInfo,
    ContainerStats,
    ContainerTerminalAttachment,
    CreateRuntimeContainerOptions,
    RuntimeContainerInfo
} from '@shared/contracts/ports/ContainerRuntime';
import { ChannelCommands } from '@shared/contracts/types/team-cluster-daemon-channel';

export interface RuntimeContainerSummary {
    Id: string;
    State?: string;
}

type ContainerRuntimeAction = 'start' | 'stop' | 'restart';

interface ReadContainerFileResponse {
    contents: string;
}

class DaemonCommandCache<T> {
    private readonly entries = new Map<string, { expiresAt: number; value: T }>();
    private readonly pending = new Map<string, Promise<T>>();

    constructor(private readonly ttlMs: number) {}

    async read(cacheKey: string, load: () => Promise<T>): Promise<T> {
        const cached = this.entries.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.value;
        }

        const pending = this.pending.get(cacheKey);
        if (pending) {
            return pending;
        }

        const loadPromise = load().then((value) => {
            this.entries.set(cacheKey, {
                expiresAt: Date.now() + this.ttlMs,
                value
            });
            return value;
        }).finally(() => {
            this.pending.delete(cacheKey);
        });

        this.pending.set(cacheKey, loadPromise);
        return loadPromise;
    }

    clear(cacheKey: string): void {
        this.entries.delete(cacheKey);
        this.pending.delete(cacheKey);
    }
}

export class DaemonContainerRuntimeService {
    private readonly stats = new DaemonCommandCache<ContainerStats>(3_000);
    private readonly processes = new DaemonCommandCache<ContainerProcessInfo[]>(5_000);

    async listContainers(teamClusterId: string): Promise<RuntimeContainerSummary[]> {
        return teamClusterDaemonClient.command<RuntimeContainerSummary[]>(teamClusterId, ChannelCommands.ContainerList);
    }

    async createContainer(teamClusterId: string, config: CreateRuntimeContainerOptions): Promise<RuntimeContainerInfo> {
        const container = await teamClusterDaemonClient.command<RuntimeContainerInfo>(teamClusterId, ChannelCommands.ContainerCreate, { ...config }, {
            timeoutMs: 5 * 60 * 1000
        });
        this.clearContainerCache(teamClusterId, container.Id);
        return container;
    }

    async getContainer(teamClusterId: string, containerId: string): Promise<RuntimeContainerInfo> {
        return teamClusterDaemonClient.command<RuntimeContainerInfo>(teamClusterId, ChannelCommands.ContainerGet, { containerId });
    }

    async removeContainer(teamClusterId: string, containerId: string): Promise<void> {
        await teamClusterDaemonClient.command<{ deleted: boolean; }>(teamClusterId, ChannelCommands.ContainerDelete, { containerId });
        this.clearContainerCache(teamClusterId, containerId);
    }

    async getStats(teamClusterId: string, containerId: string): Promise<ContainerStats> {
        return this.stats.read(this.buildContainerCacheKey(teamClusterId, containerId), () => {
            return teamClusterDaemonClient.command<ContainerStats>(teamClusterId, ChannelCommands.ContainerStats, { containerId });
        });
    }

    async getProcesses(teamClusterId: string, containerId: string): Promise<ContainerProcessInfo[]> {
        return this.processes.read(this.buildContainerCacheKey(teamClusterId, containerId), () => {
            return teamClusterDaemonClient.command<ContainerProcessInfo[]>(teamClusterId, ChannelCommands.ContainerProcessesList, { containerId });
        });
    }

    async getFiles(teamClusterId: string, containerId: string, path: string): Promise<ContainerFileEntry[]> {
        return teamClusterDaemonClient.command<ContainerFileEntry[]>(teamClusterId, ChannelCommands.ContainerFilesList, {
            containerId,
            path
        });
    }

    async readFile(teamClusterId: string, containerId: string, path: string): Promise<string> {
        const response = await teamClusterDaemonClient.command<ReadContainerFileResponse>(teamClusterId, ChannelCommands.ContainerFileRead, {
            containerId,
            path
        });

        return response.contents;
    }

    async attachTerminal(teamClusterId: string, containerId: string): Promise<ContainerTerminalAttachment> {
        return teamClusterDaemonClient.attachTerminal(teamClusterId, containerId);
    }

    async applyContainerAction(teamClusterId: string, containerId: string, action: ContainerRuntimeAction): Promise<RuntimeContainerInfo> {
        const container = await teamClusterDaemonClient.command<RuntimeContainerInfo>(
            teamClusterId,
            ChannelCommands.ContainerUpdate,
            {
                containerId,
                action
            }
        );
        this.clearContainerCache(teamClusterId, containerId);
        return container;
    }

    private buildContainerCacheKey(teamClusterId: string, containerId: string): string {
        return `${teamClusterId}:${containerId}`;
    }

    private clearContainerCache(teamClusterId: string, containerId: string): void {
        const cacheKey = this.buildContainerCacheKey(teamClusterId, containerId);
        this.stats.clear(cacheKey);
        this.processes.clear(cacheKey);
    }
}

export default new DaemonContainerRuntimeService();
