import eventBus from '@shared/infrastructure/events/RedisEventBus';
import { ErrorCodes } from '@core/constants/error-codes';
import { ContainerModel } from '@modules/container/models/ContainerModel';
import type { IContainer } from '@modules/container/models/ContainerModel';
import daemonContainerRuntimeService from '@modules/container/services/DaemonContainerRuntimeService';
import containerPublicPortAllocator from '@modules/container/services/ContainerPublicPortAllocator';
import containerPortProxyRelayService from '@modules/container/services/ContainerPortProxyRelayService';
import ContainerCreatedEvent from '@modules/container/events/ContainerCreatedEvent';
import ContainerDeletedEvent from '@modules/container/events/ContainerDeletedEvent';
import ContainerUpdatedEvent from '@modules/container/events/ContainerUpdatedEvent';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import SystemMetricsRedisRepository from '@modules/system/repositories/SystemMetricsRedisRepository';
import type { ITeamClusterSelectionService } from '@shared/contracts/ports/ITeamClusterSelectionService';
import type {
    ContainerAccessiblePort
} from '@volt/contracts/modules/container/domain';
import type {
    ContainerEnvironmentVariable,
    ContainerFileEntry,
    ContainerPortMapping,
    ContainerProcessInfo,
    ContainerStats,
    RuntimeContainerInfo
} from '@shared/contracts/ports/IContainerService';
import type {
    CreateContainerInput,
    UpdateContainerInput,
    CreateContainerFolderInput,
    UpdateContainerFolderInput
} from '@volt/contracts/modules/container/http';
import { CatalogFolderKind } from '@shared/domain/catalog/CatalogFolder';
import CatalogFolderModel from '@shared/infrastructure/persistence/mongo/models/CatalogFolderModel';
import { CLUSTER_ACCESS_TOKENS } from '@shared/contracts/tokens/ClusterAccessTokens';
import { USER_POPULATE, CLUSTER_POPULATE } from '@shared/infrastructure/persistence/mongo/PopulatePresets';
import type { PaginatedResult } from '@shared/domain/port/IBaseRepository';
import logger from '@shared/infrastructure/logger';
import mongoose from 'mongoose';
import type { HydratedDocument } from 'mongoose';
import { container as diContainer } from 'tsyringe';

type ContainerDoc = HydratedDocument<IContainer>;

const MB_PER_GB = 1024;
const PLACEHOLDER_INTERNAL_IP = '0.0.0.0';

const BROWSER_ACCESSIBLE_PORTS = new Set([80, 81, 3000, 3001, 4173, 4200, 5000, 5173, 5174, 8000, 8080, 8081, 8088, 8888, 8889]);
const BROWSER_ACCESSIBLE_LABELS = [/^https?$/i, /^web$/i, /^app$/i, /^ui$/i, /^dashboard$/i, /^jupyter$/i];

interface ContainerListQuery {
    folderId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

interface ContainerFolderQuery {
    parentId?: string | null;
    page?: number;
    limit?: number;
}

interface ContainerFolderView {
    _id: string;
    title: string;
    parent: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export default class ContainerService {
    #runtime = daemonContainerRuntimeService;
    #portAllocator = containerPublicPortAllocator;
    #relay = containerPortProxyRelayService;
    #systemMetrics = new SystemMetricsRedisRepository();

    #clusterSelectionCache?: ITeamClusterSelectionService;
    get #clusterSelection(): ITeamClusterSelectionService {
        return (this.#clusterSelectionCache ??= diContainer.resolve<ITeamClusterSelectionService>(CLUSTER_ACCESS_TOKENS.TeamClusterSelectionService));
    }

        #eventBus = eventBus;

    async create(teamId: string, userId: string, input: CreateContainerInput): Promise<{ container: ContainerDoc }> {
        const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd, memory, cpus } = input;

        if (input.folderId) {
            const folder = await CatalogFolderModel.findOne({ _id: input.folderId, team: teamId, kind: CatalogFolderKind.Container });
            if (!folder) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target container folder not found');
            }
        }

        const teamClusterId = await this.#clusterSelection.resolveConnectedClusterId(teamId, input.teamClusterId);

        let containerCmd = cmd && Array.isArray(cmd) && cmd.length > 0 ? cmd : undefined;
        if (!containerCmd && !useImageCmd) {
            containerCmd = ['tail', '-f', '/dev/null'];
        }

        const memoryInMegabytes = memory || 512;
        const cpuCount = cpus || 1;
        await this.#validateClusterResourceLimits(teamClusterId, memoryInMegabytes, cpuCount);

        const sanitizedName = name.replace(/\s+/g, '-').toLowerCase();
        const binds: string[] = [`Volt-${sanitizedName}-data:/data`];
        const groupAdd: string[] = [];

        if (mountDockerSocket) {
            binds.push('/var/run/docker.sock:/var/run/docker.sock');
        }

        const reservedPortMappings = await this.#portAllocator.reservePortMappings(ports);
        const assignedPorts = reservedPortMappings.ports;
        let dockerId: string | null = null;
        let persistedContainerId: string | null = null;

        try {
            const dockerConfig = this.#buildContainerRuntimeConfig(
                { image, name, env, ports: this.#toRuntimePorts(assignedPorts), teamId, teamClusterId, operationId: input.operationId },
                { memoryInMegabytes, cpus: cpuCount, binds, groupAdd, cmd: containerCmd }
            );

            const containerInfo = await this.#runtime.createContainer(teamClusterId, dockerConfig);
            dockerId = containerInfo.Id;
            const runtimeContainer = await this.#runtime.getContainer(teamClusterId, dockerId);
            const internalIp = this.#requireInternalIp(runtimeContainer);

            const container = new ContainerModel({
                name,
                image,
                containerId: dockerId,
                folder: input.folderId ? new mongoose.Types.ObjectId(input.folderId) : null,
                status: runtimeContainer.State?.Status || containerInfo.State?.Status || 'running',
                memory: memoryInMegabytes,
                cpus: cpuCount,
                env: env || [],
                ports: assignedPorts,
                createdBy: new mongoose.Types.ObjectId(userId),
                team: new mongoose.Types.ObjectId(teamId),
                teamCluster: new mongoose.Types.ObjectId(teamClusterId),
                mountDockerSocket: mountDockerSocket || false,
                internalIp
            });
            await container.save();
            persistedContainerId = String(container._id);

            await this.#relay.ensureContainerRelays(assignedPorts.map((port) => ({
                teamId,
                containerId: persistedContainerId as string,
                teamClusterId,
                internalIp,
                privatePort: port.private,
                publicPort: port.public as number
            })));
            this.#portAllocator.commitReservations(reservedPortMappings.reservedPublicPorts);

            await this.#eventBus.publish(new ContainerCreatedEvent({ containerId: persistedContainerId, teamId, name, userId }));

            return { container };
        } catch (error) {
            this.#portAllocator.releaseReservations(reservedPortMappings.reservedPublicPorts);

            if (persistedContainerId) {
                await ContainerModel.deleteOne({ _id: persistedContainerId }).catch(() => undefined);
                await this.#relay.stopContainerRelays(persistedContainerId).catch(() => undefined);
            }

            if (dockerId) {
                await this.#runtime.removeContainer(teamClusterId, dockerId).catch(() => undefined);
            }

            throw error;
        }
    }

    async list(teamId: string, _userId: string, query: ContainerListQuery): Promise<PaginatedResult<Record<string, unknown>>> {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 100;
        const filter: Record<string, unknown> = { team: teamId };

        if (query.folderId === 'root') {
            filter.folder = null;
        } else if (query.folderId) {
            filter.folder = query.folderId;
        }

        if (query.search) {
            const escapedSearch = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            filter.name = { $regex: escapedSearch, $options: 'i' };
        }

        const [docs, total] = await Promise.all([
            ContainerModel.find(filter)
                .skip((page - 1) * limit)
                .limit(limit)
                .sort({ updatedAt: -1 })
                .populate(USER_POPULATE)
                .populate(CLUSTER_POPULATE)
                .exec(),
            ContainerModel.countDocuments(filter)
        ]);

        this.#scheduleRuntimeStatusSync(docs);

        const data = docs.map((doc) => {
            const view = doc.toObject() as unknown as Record<string, unknown>;
            view.accessiblePorts = this.#resolveAccessiblePorts(doc.ports, doc.status);
            return view;
        });

        return {
            data,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getById(teamId: string, containerId: string): Promise<{ container: Record<string, unknown> }> {
        const container = await this.#getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.#clusterId(container);

        if (teamClusterId) {
            const runtimeContainer = await this.#runtime.getContainer(teamClusterId, container.containerId);
            if (runtimeContainer.State?.Status) {
                container.status = runtimeContainer.State.Status;
            }
        }

        const view = container.toObject() as unknown as Record<string, unknown>;
        view.accessiblePorts = this.#resolveAccessiblePorts(container.ports, container.status);
        return { container: view };
    }

    async update(teamId: string, containerId: string, input: UpdateContainerInput): Promise<{ container: ContainerDoc | null; status?: string }> {
        const { action, env, ports } = input;
        const container = await this.#getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.#requireTeamClusterId(this.#clusterId(container));

        if (action) {
            let runtimeContainer: RuntimeContainerInfo | null = null;
            if (action === 'start') {
                runtimeContainer = await this.#runtime.startContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'running';
            } else if (action === 'stop') {
                runtimeContainer = await this.#runtime.stopContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'exited';
            } else if (action === 'restart') {
                runtimeContainer = await this.#runtime.restartContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'running';
            }

            const internalIp = runtimeContainer ? this.#resolveInternalIp(runtimeContainer) : undefined;
            if (internalIp) {
                container.internalIp = internalIp;
            }

            await container.save();

            if (internalIp && (action === 'start' || action === 'restart')) {
                await this.#relay.ensureContainerRelays(container.ports
                    .filter((port) => typeof port.public === 'number' && port.public > 0)
                    .map((port) => ({
                        teamId,
                        containerId: String(container._id),
                        teamClusterId,
                        internalIp,
                        privatePort: port.private,
                        publicPort: port.public as number
                    })));
            }

            await this.#publishContainerUpdatedEvent(containerId, teamId, container.name);

            return { container, status: container.status };
        }

        const effectiveEnv = env || container.env;
        let reservedPublicPorts: number[] = [];
        let nextRelays: Array<{ teamId: string; containerId: string; teamClusterId: string; internalIp: string; privatePort: number; publicPort: number }> = [];
        let newPublicPorts: number[] = [];
        let nextPorts: ContainerPortMapping[] | undefined;

        if (ports) {
            const resolvedPorts = await this.#resolveUpdatedPorts(ports, container.ports, String(container._id));
            nextPorts = resolvedPorts.ports;
            reservedPublicPorts = resolvedPorts.reservedPublicPorts;
            const existingPublicPorts = new Set(container.ports
                .map((port) => port.public)
                .filter((port): port is number => typeof port === 'number' && port > 0));
            const internalIp = this.#requireRelayInternalIp(container.internalIp);

            nextRelays = nextPorts.map((port) => ({
                teamId,
                containerId: String(container._id),
                teamClusterId,
                internalIp,
                privatePort: port.private,
                publicPort: port.public as number
            }));
            newPublicPorts = nextRelays
                .map((relay) => relay.publicPort)
                .filter((publicPort) => !existingPublicPorts.has(publicPort));
        }

        try {
            if (nextRelays.length > 0) {
                await this.#relay.ensureContainerRelays(nextRelays);
            }

            container.env = effectiveEnv;
            if (nextPorts) {
                container.ports = nextPorts;
            }
            await container.save();
            this.#portAllocator.commitReservations(reservedPublicPorts);

            if (nextPorts) {
                await this.#relay.syncContainerRelays(String(container._id), nextRelays);
            }

            await this.#publishContainerUpdatedEvent(containerId, teamId, container.name);

            return { container };
        } catch (error) {
            this.#portAllocator.releaseReservations(reservedPublicPorts);
            await this.#relay.stopPublicPortRelays(newPublicPorts).catch(() => undefined);
            throw error;
        }
    }

    async delete(teamId: string, containerId: string, userId: string): Promise<{ message: string }> {
        const container = await this.#getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.#requireTeamClusterId(this.#clusterId(container));

        await this.#runtime.removeContainer(teamClusterId, container.containerId);
        await ContainerModel.deleteOne({ _id: containerId });
        await this.#relay.stopContainerRelays(String(container._id));

        await this.#eventBus.publish(new ContainerDeletedEvent({
            containerId,
            teamId: container.team ? String(container.team) : '',
            userId,
            containerName: container.name ?? ''
        }));

        return { message: 'Container deleted successfully' };
    }

    async createPortAccessUrl(
        teamId: string,
        containerId: string,
        privatePort: number,
        userId: string
    ): Promise<{ url: string; expiresAt: string; port: ContainerAccessiblePort }> {
        const container = await this.#getOwnedByTeam(containerId, teamId);
        const accessiblePorts = this.#resolveAccessiblePorts(container.ports, container.status);
        const port = accessiblePorts.find((item) => item.private === privatePort);

        if (!port) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container port is not exposed');
        }
        if (!port.browserAccessible) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, 'Container port is not browser accessible');
        }
        if (port.status !== 'available') {
            throw ApplicationError.conflict('Container::PortUnavailable', 'Container must be running to open this port');
        }
        if (!port.public) {
            throw ApplicationError.conflict('Container::PublicPortUnavailable', 'Container port has no public port assigned');
        }

        const teamClusterId = this.#clusterId(container);
        if (!teamClusterId || !container.internalIp) {
            throw ApplicationError.conflict('Container::PortUnavailable', 'Container networking is not ready yet');
        }

        const accessUrl = await this.#relay.createAccessUrl({
            teamId,
            containerId: String(container._id),
            userId,
            teamClusterId,
            internalIp: container.internalIp,
            privatePort,
            publicPort: port.public
        });

        return { url: accessUrl.url, expiresAt: accessUrl.expiresAt, port };
    }

    async getFiles(teamId: string, containerId: string, path?: string): Promise<{ files: ContainerFileEntry[] }> {
        const container = await this.#getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.#requireTeamClusterId(this.#clusterId(container));
        const files = await this.#runtime.getFiles(teamClusterId, container.containerId, path || '/');
        return { files };
    }

    async getProcesses(teamId: string, containerId: string): Promise<{ processes: ContainerProcessInfo[] }> {
        const container = await this.#getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.#requireTeamClusterId(this.#clusterId(container));
        const processes = await this.#runtime.getProcesses(teamClusterId, container.containerId);
        return { processes };
    }

    async getStats(teamId: string, containerId: string): Promise<{
        stats: ContainerStats;
        limits: { memory: number; cpus: number };
        memoryMB: { used: number; total: number; free: number };
        networkTotals: { rxBytes: number; txBytes: number };
    }> {
        const container = await this.#getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.#requireTeamClusterId(this.#clusterId(container));
        const stats = await this.#runtime.getStats(teamClusterId, container.containerId);

        const usedBytes = stats.memory_stats?.usage ?? 0;
        const limitBytes = stats.memory_stats?.limit ?? 0;
        const usedMB = usedBytes / 1024 / 1024;
        const totalMB = limitBytes / 1024 / 1024;

        const networks = stats.networks ?? {};
        let rxBytes = 0;
        let txBytes = 0;
        for (const iface of Object.values(networks)) {
            rxBytes += iface.rx_bytes ?? 0;
            txBytes += iface.tx_bytes ?? 0;
        }

        return {
            stats,
            limits: { memory: container.memory * 1024 * 1024, cpus: container.cpus },
            memoryMB: {
                used: Math.round(usedMB * 100) / 100,
                total: Math.round(totalMB * 100) / 100,
                free: Math.round((totalMB - usedMB) * 100) / 100
            },
            networkTotals: { rxBytes, txBytes }
        };
    }

    async readFile(teamId: string, containerId: string, path: string): Promise<{ content: string }> {
        const container = await this.#getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.#requireTeamClusterId(this.#clusterId(container));
        const content = await this.#runtime.readFile(teamClusterId, container.containerId, path);
        return { content };
    }

    async move(teamId: string, containerId: string, folderId: string | null): Promise<null> {
        try {
            const container = await ContainerModel.findOne({ _id: containerId, team: teamId });
            if (!container) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container not found');
            }

            if (folderId !== null) {
                const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Container });
                if (!folder) {
                    throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Target Container folder not found');
                }
            }

            container.folder = folderId ? new mongoose.Types.ObjectId(folderId) : null;
            await container.save();
            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to move Container', 500);
        }
    }


    async listFolders(teamId: string, query: ContainerFolderQuery): Promise<PaginatedResult<ContainerFolderView>> {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 500;
        const filter = { team: teamId, kind: CatalogFolderKind.Container, parent: query.parentId ?? null };

        const [docs, total] = await Promise.all([
            CatalogFolderModel.find(filter).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 }).exec(),
            CatalogFolderModel.countDocuments(filter)
        ]);

        return {
            data: docs.map((doc) => this.#presentFolder(doc)),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            limit
        };
    }

    async getFolder(teamId: string, folderId: string): Promise<ContainerFolderView> {
        const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Container });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container folder not found');
        }
        return this.#presentFolder(folder);
    }

    async createFolder(teamId: string, userId: string, input: CreateContainerFolderInput): Promise<ContainerFolderView> {
        const folder = new CatalogFolderModel({
            team: new mongoose.Types.ObjectId(teamId),
            createdBy: new mongoose.Types.ObjectId(userId),
            title: input.title,
            parent: input.parentId ? new mongoose.Types.ObjectId(input.parentId) : null,
            kind: CatalogFolderKind.Container
        });
        await folder.save();
        return this.#presentFolder(folder);
    }

    async updateFolder(teamId: string, folderId: string, input: UpdateContainerFolderInput): Promise<ContainerFolderView> {
        const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Container });
        if (!folder) {
            throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container folder not found');
        }
        folder.title = input.title;
        await folder.save();
        return this.#presentFolder(folder);
    }

    async deleteFolder(teamId: string, folderId: string, userId: string): Promise<null> {
        try {
            const folder = await CatalogFolderModel.findOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Container });
            if (!folder) {
                throw ApplicationError.notFound(ErrorCodes.RESOURCE_NOT_FOUND, 'Container folder not found');
            }

            await this.#deleteFolderTree(teamId, folderId, userId);
            return null;
        } catch (error) {
            if (error instanceof ApplicationError) {
                throw error;
            }
            throw new ApplicationError(ErrorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete Container folder', 500);
        }
    }


    async #getOwnedByTeam(containerId: string, teamId: string): Promise<ContainerDoc> {
        const container = await ContainerModel.findById(containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }
        if (container.team?.toString() !== teamId) {
            throw new ApplicationError(ErrorCodes.TEAM_ACCESS_DENIED, 'Container does not belong to the requested team', 403);
        }
        return container;
    }

    async #deleteFolderTree(teamId: string, folderId: string, userId: string): Promise<void> {
        const subfolders = await CatalogFolderModel.find({ team: teamId, parent: folderId, kind: CatalogFolderKind.Container });
        for (const subfolder of subfolders) {
            await this.#deleteFolderTree(teamId, String(subfolder._id), userId);
        }

        const containers = await ContainerModel.find({ team: teamId, folder: folderId }).select('_id').exec();
        for (const containerDoc of containers) {
            await this.delete(teamId, String(containerDoc._id), userId);
        }

        await CatalogFolderModel.deleteOne({ _id: folderId, team: teamId, kind: CatalogFolderKind.Container });
    }

    #presentFolder(folder: { _id: unknown; title: string; parent: unknown; createdAt: Date; updatedAt: Date }): ContainerFolderView {
        return {
            _id: String(folder._id),
            title: folder.title,
            parent: folder.parent ? String(folder.parent) : null,
            createdAt: folder.createdAt,
            updatedAt: folder.updatedAt
        };
    }

    #clusterId(container: ContainerDoc): string | undefined {
        return container.teamCluster ? String(container.teamCluster) : undefined;
    }

    #resolveAccessiblePorts(ports: ContainerPortMapping[], containerStatus: string): ContainerAccessiblePort[] {
        return ports.map((port) => ({
            private: port.private,
            public: port.public,
            protocol: 'tcp',
            browserAccessible: this.#isBrowserAccessible(port),
            status: containerStatus === 'running' ? 'available' : 'unavailable'
        }));
    }

    #isBrowserAccessible(port: ContainerPortMapping): boolean {
        if (BROWSER_ACCESSIBLE_PORTS.has(port.private) || (typeof port.public === 'number' && BROWSER_ACCESSIBLE_PORTS.has(port.public))) {
            return true;
        }
        const rawLabel = (port as ContainerPortMapping & { label?: unknown }).label;
        const label = typeof rawLabel === 'string' && rawLabel.trim().length > 0 ? rawLabel.trim().toLowerCase() : null;
        if (!label) {
            return false;
        }
        return BROWSER_ACCESSIBLE_LABELS.some((pattern) => pattern.test(label));
    }

    #buildContainerRuntimeConfig(
        input: { image: string; name: string; env?: ContainerEnvironmentVariable[]; ports?: ContainerPortMapping[]; teamId: string; teamClusterId: string; operationId?: string },
        options: { memoryInMegabytes: number; cpus: number; binds: string[]; groupAdd: string[]; cmd?: string[]; user?: string }
    ) {
        const sanitizedName = input.name.replace(/\s+/g, '-');
        return {
            image: input.image,
            name: `${sanitizedName}-${Date.now()}`,
            operationId: input.operationId,
            env: input.env,
            ports: input.ports,
            labels: {
                'volt.team.id': input.teamId,
                'volt.team-cluster.id': input.teamClusterId
            },
            memoryInMegabytes: options.memoryInMegabytes,
            cpus: options.cpus,
            binds: options.binds,
            groupAdd: options.groupAdd,
            cmd: options.cmd,
            user: options.user
        };
    }

    #toRuntimePorts(ports: ContainerPortMapping[]): ContainerPortMapping[] {
        return ports.map((port) => ({ private: port.private }));
    }

    #resolveInternalIp(runtimeContainer: RuntimeContainerInfo): string | undefined {
        const primaryIp = runtimeContainer.NetworkSettings?.IPAddress;
        if (typeof primaryIp === 'string' && primaryIp.length > 0) {
            return primaryIp;
        }
        const networks = runtimeContainer.NetworkSettings?.Networks;
        if (!networks) {
            return undefined;
        }
        for (const endpoint of Object.values(networks)) {
            const address = endpoint?.IPAddress;
            if (typeof address === 'string' && address.length > 0) {
                return address;
            }
        }
        return undefined;
    }

    #requireInternalIp(runtimeContainer: RuntimeContainerInfo): string {
        const internalIp = this.#resolveInternalIp(runtimeContainer);
        if (!internalIp) {
            throw ApplicationError.conflict('Container::NetworkingUnavailable', 'Container networking is not ready');
        }
        return internalIp;
    }

    #requireRelayInternalIp(internalIp?: string): string {
        if (!internalIp) {
            throw ApplicationError.conflict('Container::PortUnavailable', 'Container networking is not ready yet');
        }
        return internalIp;
    }

    #requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }
        return teamClusterId;
    }

    async #validateClusterResourceLimits(teamClusterId: string, memoryInMegabytes: number, cpuCount: number): Promise<void> {
        const metrics = await this.#systemMetrics.getLatestByClusterId(teamClusterId);
        if (!metrics) {
            return;
        }
        const maxCpus = metrics.cpu.cores;
        const maxMemoryInMegabytes = Math.floor(metrics.memory.total * MB_PER_GB);

        if (cpuCount > maxCpus) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Requested CPU allocation exceeds cluster capacity (${maxCpus} vCPU max)`);
        }
        if (memoryInMegabytes > maxMemoryInMegabytes) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Requested memory allocation exceeds cluster capacity (${maxMemoryInMegabytes} MB max)`);
        }
    }

    async #resolveUpdatedPorts(
        requestedPorts: ContainerPortMapping[],
        existingPorts: ContainerPortMapping[],
        containerId: string
    ): Promise<{ ports: ContainerPortMapping[]; reservedPublicPorts: number[] }> {
        const existingPortsByPrivatePort = new Map(existingPorts.map((port) => [port.private, port]));
        const requestedPrivatePorts = new Set<number>();
        const requestedPublicPorts = new Set<number>();
        const resolvedPorts: ContainerPortMapping[] = [];
        const reservedPublicPorts: number[] = [];

        try {
            for (const requestedPort of requestedPorts) {
                if (requestedPrivatePorts.has(requestedPort.private)) {
                    throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Container port ${requestedPort.private} is declared more than once`);
                }
                requestedPrivatePorts.add(requestedPort.private);

                const existingPort = existingPortsByPrivatePort.get(requestedPort.private);
                if (existingPort?.public && requestedPort.public === undefined) {
                    this.#assertUniqueResolvedPublicPort(existingPort.public, requestedPublicPorts);
                    resolvedPorts.push({ private: requestedPort.private, public: existingPort.public });
                    continue;
                }
                if (existingPort?.public && requestedPort.public === existingPort.public) {
                    this.#assertUniqueResolvedPublicPort(existingPort.public, requestedPublicPorts);
                    resolvedPorts.push({ private: requestedPort.private, public: existingPort.public });
                    continue;
                }

                const reservedPortMapping = await this.#portAllocator.reservePortMappings([requestedPort], { excludeContainerId: containerId });
                reservedPublicPorts.push(...reservedPortMapping.reservedPublicPorts);
                this.#assertUniqueResolvedPublicPort(reservedPortMapping.ports[0].public as number, requestedPublicPorts);
                resolvedPorts.push(reservedPortMapping.ports[0]);
            }

            return { ports: resolvedPorts, reservedPublicPorts };
        } catch (error) {
            this.#portAllocator.releaseReservations(reservedPublicPorts);
            throw error;
        }
    }

    #assertUniqueResolvedPublicPort(publicPort: number, requestedPublicPorts: Set<number>): void {
        if (requestedPublicPorts.has(publicPort)) {
            throw ApplicationError.badRequest(ErrorCodes.VALIDATION_INVALID_INPUT, `Public port ${publicPort} is declared more than once`);
        }
        requestedPublicPorts.add(publicPort);
    }

    async #publishContainerUpdatedEvent(containerId: string, teamId: string, containerName: string): Promise<void> {
        await this.#eventBus.publish(new ContainerUpdatedEvent({ containerId, teamId, containerName }));
    }

    #scheduleRuntimeStatusSync(containers: ContainerDoc[]): void {
        const snapshot = containers.map((container) => ({
            id: String(container._id),
            containerId: container.containerId,
            status: container.status,
            internalIp: container.internalIp,
            teamClusterId: this.#populatedClusterId(container)
        }));

        void this.#syncRuntimeStatus(snapshot).catch(() => {
            logger.warn(`Background container runtime sync failed containerCount=${containers.length}`);
        });
    }

    #populatedClusterId(container: ContainerDoc): string | undefined {
        const teamCluster = container.teamCluster as unknown as { _id?: unknown } | mongoose.Types.ObjectId | undefined;
        if (!teamCluster) {
            return undefined;
        }
        if (typeof teamCluster === 'object' && '_id' in teamCluster && teamCluster._id) {
            return String(teamCluster._id);
        }
        return String(teamCluster);
    }

    async #syncRuntimeStatus(
        containers: Array<{ id: string; containerId: string; status: string; internalIp?: string; teamClusterId?: string }>
    ): Promise<void> {
        const runtimeIndex = new Map<string, { Id: string; State?: string }>();
        const teamClusterIds = Array.from(new Set(containers
            .map((container) => container.teamClusterId)
            .filter((teamClusterId): teamClusterId is string => Boolean(teamClusterId))));

        await Promise.all(teamClusterIds.map(async (teamClusterId) => {
            try {
                const runtimeContainers = await this.#runtime.listContainers(teamClusterId);
                runtimeContainers.forEach((runtimeContainer) => {
                    runtimeIndex.set(`${teamClusterId}:${runtimeContainer.Id}`, runtimeContainer);
                });
            } catch {
            }
        }));

        await Promise.all(containers.map(async (container) => {
            const teamClusterId = container.teamClusterId;
            if (!teamClusterId) {
                return;
            }
            const runtimeContainer = runtimeIndex.get(`${teamClusterId}:${container.containerId}`);
            if (!runtimeContainer) {
                return;
            }

            const update: { status?: string; internalIp?: string } = {};
            if (runtimeContainer.State && runtimeContainer.State !== container.status) {
                update.status = runtimeContainer.State;
            }

            if (container.internalIp === undefined || container.internalIp === PLACEHOLDER_INTERNAL_IP) {
                try {
                    const runtimeInfo = await this.#runtime.getContainer(teamClusterId, container.containerId);
                    const runtimeInternalIp = this.#resolveNonPlaceholderInternalIp(runtimeInfo);
                    if (runtimeInternalIp !== undefined && container.internalIp !== runtimeInternalIp) {
                        update.internalIp = runtimeInternalIp;
                    }
                } catch {
                }
            }

            if (Object.keys(update).length === 0) {
                return;
            }

            await ContainerModel.updateOne({ _id: container.id }, { $set: update }).catch(() => undefined);
        }));
    }

    #resolveNonPlaceholderInternalIp(runtimeContainer: RuntimeContainerInfo): string | undefined {
        const primaryIp = runtimeContainer.NetworkSettings?.IPAddress;
        if (typeof primaryIp === 'string' && primaryIp.length > 0 && primaryIp !== PLACEHOLDER_INTERNAL_IP) {
            return primaryIp;
        }
        const networks = runtimeContainer.NetworkSettings?.Networks;
        if (!networks) {
            return undefined;
        }
        for (const endpoint of Object.values(networks)) {
            const internalIp = endpoint?.IPAddress;
            if (typeof internalIp === 'string' && internalIp.length > 0 && internalIp !== PLACEHOLDER_INTERNAL_IP) {
                return internalIp;
            }
        }
        return undefined;
    }
}
