import { USER_POPULATE, CLUSTER_POPULATE } from '@shared/application/PopulatePresets';
import { ListContainersInputDTO, ListContainersOutputDTO } from '@modules/container/application/dtos/ListContainersDTO';
import type { IContainerProps, Container } from '@modules/container/domain/entities/Container';
import type { RuntimeContainerInfo } from '@modules/container/domain/port/IContainerService';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import type { RuntimeContainerSummary } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';

interface ListContainersFilter extends Record<string, unknown> {
    team: string;
    folder?: string | null;
};

interface ContainerRuntimeDriftUpdate extends Partial<Pick<IContainerProps, 'status' | 'internalIp' | 'ports'>> {};

const PLACEHOLDER_INTERNAL_IP = '0.0.0.0';
const PLACEHOLDER_PUBLIC_PORT = 0;

const getTeamClusterId = (teamCluster: unknown): string | null => {
    if (!teamCluster) {
        return null;
    }

    if (typeof teamCluster === 'string') {
        return teamCluster;
    }

    if (typeof teamCluster === 'object' && teamCluster !== null && '_id' in teamCluster) {
        const objectId = teamCluster._id;
        if (typeof objectId === 'string') {
            return objectId;
        }
    }

    return null;
};

@injectable()
export class ListContainersUseCase implements IUseCase<ListContainersInputDTO, ListContainersOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService
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

        await this.syncRuntimeStatus(result.data);

        return Result.ok(result);
    }

    private async syncRuntimeStatus(containers: Container[]): Promise<void> {
        const runtimeIndex = new Map<string, RuntimeContainerSummary>();
        const teamClusterIds = Array.from(new Set(containers
            .map((container) => getTeamClusterId(container.teamCluster))
            .filter((teamClusterId): teamClusterId is string => typeof teamClusterId === 'string' && teamClusterId.length > 0)));

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
            const teamClusterId = getTeamClusterId(container.teamCluster);
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
