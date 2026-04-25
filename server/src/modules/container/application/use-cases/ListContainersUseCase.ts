import { ListContainersInputDTO, ListContainersOutputDTO } from '@modules/container/application/dtos/ListContainersDTO';
import type { Container, IContainerProps } from '@modules/container/domain/entities/Container';
import type { RuntimeContainerInfo } from '@modules/container/domain/port/IContainerService';
import type { RuntimeContainerSummary } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { ContainerAccessiblePortResolver } from '@modules/container/infrastructure/services/ContainerAccessiblePortResolver';
import { DaemonContainerRuntimeService } from '@modules/container/infrastructure/services/DaemonContainerRuntimeService';
import { IUseCase } from '@shared/application/IUseCase';
import { CLUSTER_POPULATE, USER_POPULATE } from '@shared/application/PopulatePresets';
import { Result } from '@shared/domain/port/Result';
import logger from '@shared/infrastructure/logger';
import { injectable } from 'tsyringe';

interface ListContainersFilter extends Record<string, unknown> {
    team: string;
    folder?: string | null;
};

interface ContainerRuntimeDriftUpdate extends Partial<Pick<IContainerProps, 'status' | 'internalIp' | 'ports'>> {};

interface PopulatedContainerTeamCluster {
    _id: string;
}

const PLACEHOLDER_INTERNAL_IP = '0.0.0.0';
const PLACEHOLDER_PUBLIC_PORT = 0;

@injectable()
export class ListContainersUseCase implements IUseCase<ListContainersInputDTO, ListContainersOutputDTO> {
    constructor(
        private repository: ContainerRepository,
        private containerRuntimeService: DaemonContainerRuntimeService,
        private accessiblePortResolver: ContainerAccessiblePortResolver
    ) {}

    async execute(input: ListContainersInputDTO): Promise<Result<ListContainersOutputDTO>> {
        const filter: ListContainersFilter = {
            team: input.teamId
        };

        if (input.folderId === 'root') {
            filter.folder = null;
        } else if (input.folderId) {
            filter.folder = input.folderId;
        }

        if (input.search) {
            filter.name = { $regex: input.search, $options: 'i' };
        }

        const result = await this.repository.findAll({
            filter,
            page: input.page,
            limit: input.limit,
            sort: { updatedAt: -1 },
            populate: [
                USER_POPULATE,
                CLUSTER_POPULATE
            ]
        });

        this.scheduleRuntimeStatusSync(result.data);

        result.data.forEach((container) => {
            container.accessiblePorts = this.accessiblePortResolver.resolve(
                String(container.team || input.teamId),
                container._id,
                container.ports,
                container.status
            );
        });

        return Result.ok(result);
    }

    private scheduleRuntimeStatusSync(containers: Container[]): void {
        const containersSnapshot = containers.map((container) => ({
            ...container,
            env: [...container.env],
            ports: container.ports.map((port) => ({ ...port })),
            accessiblePorts: container.accessiblePorts?.map((port) => ({ ...port }))
        })) as Container[];

        void this.syncRuntimeStatus(containersSnapshot).catch(() => {
            logger.warn(`Background container runtime sync failed containerCount=${containers.length}`);
        });
    }

    private async syncRuntimeStatus(containers: Container[]): Promise<void> {
        const runtimeIndex = new Map<string, RuntimeContainerSummary>();
        const teamClusterIds = Array.from(new Set(containers
            .map((container) => {
                const teamCluster = container.teamCluster as string | PopulatedContainerTeamCluster | undefined;
                return typeof teamCluster === 'string' ? teamCluster : teamCluster?._id;
            })
            .filter((teamClusterId): teamClusterId is string => Boolean(teamClusterId))));

        await Promise.all(teamClusterIds.map(async (teamClusterId) => {
            try {
                const runtimeContainers = await this.containerRuntimeService.listContainers(teamClusterId);
                runtimeContainers.forEach((runtimeContainer) => {
                    runtimeIndex.set(`${teamClusterId}:${runtimeContainer.Id}`, runtimeContainer);
                });
            } catch {
            }
        }));

        await Promise.all(containers.map(async (container) => {
            const teamCluster = container.teamCluster as string | PopulatedContainerTeamCluster | undefined;
            const teamClusterId = typeof teamCluster === 'string' ? teamCluster : teamCluster?._id;
            if (!teamClusterId) {
                return;
            }

            const runtimeContainer = runtimeIndex.get(`${teamClusterId}:${container.containerId}`);
            if (!runtimeContainer) {
                return;
            }

            const update = await this.buildRuntimeDriftUpdate(container, teamClusterId, runtimeContainer);
            if (!update) {
                return;
            }

            this.applyRuntimeDriftUpdate(container, update);
            await this.repository.updateById(container._id, update);
        }));
    }

    private async buildRuntimeDriftUpdate(
        container: Container,
        teamClusterId: string,
        runtimeContainerSummary: RuntimeContainerSummary
    ): Promise<ContainerRuntimeDriftUpdate | null> {
        const update: ContainerRuntimeDriftUpdate = {};

        if (runtimeContainerSummary.State && runtimeContainerSummary.State !== container.status) {
            update.status = runtimeContainerSummary.State;
        }

        if (!this.needsNetworkingReconciliation(container)) {
            return Object.keys(update).length > 0 ? update : null;
        }

        try {
            const runtimeContainer = await this.containerRuntimeService.getContainer(teamClusterId, container.containerId);
            const runtimeInternalIp = this.getRuntimeInternalIp(runtimeContainer);
            const runtimePorts = this.getRuntimePorts(container.ports, runtimeContainer);

            if (runtimeInternalIp !== undefined) {
                if (container.internalIp !== runtimeInternalIp) {
                    update.internalIp = runtimeInternalIp;
                }
            } else if (container.internalIp === PLACEHOLDER_INTERNAL_IP) {
                update.internalIp = runtimeInternalIp;
            }

            if (this.havePortsChanged(container.ports, runtimePorts)) {
                update.ports = runtimePorts;
            }
        } catch {
        }

        return Object.keys(update).length > 0 ? update : null;
    }

    private needsNetworkingReconciliation(container: Container): boolean {
        if (container.internalIp === undefined || container.internalIp === PLACEHOLDER_INTERNAL_IP) {
            return true;
        }

        return container.ports.some((port) => port.public === undefined || port.public === PLACEHOLDER_PUBLIC_PORT);
    }

    private getRuntimeInternalIp(runtimeContainer: RuntimeContainerInfo): string | undefined {
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

    private getRuntimePorts(
        currentPorts: IContainerProps['ports'],
        runtimeContainer: RuntimeContainerInfo
    ): IContainerProps['ports'] {
        const publishedPortsByPrivatePort = new Map<number, number>();
        const runtimePorts = runtimeContainer.NetworkSettings?.Ports;

        if (runtimePorts) {
            for (const [runtimePortKey, bindings] of Object.entries(runtimePorts)) {
                const [privatePortValue, protocol] = runtimePortKey.split('/');
                if (protocol !== 'tcp' || !Array.isArray(bindings) || bindings.length === 0) {
                    continue;
                }

                const privatePort = Number(privatePortValue);
                const hostPort = Number(bindings[0]?.HostPort);

                if (Number.isNaN(privatePort) || Number.isNaN(hostPort) || hostPort <= 0) {
                    continue;
                }

                publishedPortsByPrivatePort.set(privatePort, hostPort);
            }
        }

        return currentPorts.map((port) => {
            const publicPort = publishedPortsByPrivatePort.get(port.private);

            if (publicPort === undefined) {
                if (port.public !== undefined && port.public !== PLACEHOLDER_PUBLIC_PORT) {
                    return port;
                }

                return {
                    private: port.private
                };
            }

            return {
                private: port.private,
                public: publicPort
            };
        });
    }

    private havePortsChanged(currentPorts: IContainerProps['ports'], runtimePorts: IContainerProps['ports']): boolean {
        if (currentPorts.length !== runtimePorts.length) {
            return true;
        }

        return currentPorts.some((port, index) => {
            const runtimePort = runtimePorts[index];

            return port.private !== runtimePort.private || port.public !== runtimePort.public;
        });
    }

    private applyRuntimeDriftUpdate(container: Container, update: ContainerRuntimeDriftUpdate): void {
        if (update.status) {
            container.status = update.status;
        }

        if ('internalIp' in update) {
            container.internalIp = update.internalIp;
        }

        if (update.ports) {
            container.ports = update.ports;
        }
    }
};
