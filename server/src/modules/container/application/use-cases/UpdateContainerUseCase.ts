import { ErrorCodes } from '@core/constants/error-codes';
import { UpdateContainerInputDTO, UpdateContainerOutputDTO } from '@modules/container/application/dtos/UpdateContainerDTO';
import ContainerUpdatedEvent from '@modules/container/domain/events/ContainerUpdatedEvent';
import type {
    ContainerEnvironmentVariable,
    ContainerPortMapping,
    RuntimeContainerInfo
} from '@modules/container/domain/port/IContainerService';
import { ContainerRepository } from '@modules/container/infrastructure/persistence/mongo/repositories/ContainerRepository';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { DaemonContainerRuntimeService } from '@modules/container/infrastructure/services/DaemonContainerRuntimeService';
import { ContainerPortProxyRelayService } from '@modules/container/infrastructure/services/ContainerPortProxyRelayService';
import { ContainerPublicPortAllocator } from '@modules/container/infrastructure/services/ContainerPublicPortAllocator';
import ApplicationError from '@shared/application/errors/ApplicationError';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class UpdateContainerUseCase implements IUseCase<UpdateContainerInputDTO, UpdateContainerOutputDTO> {
    constructor(
        private repository: ContainerRepository,
        private containerRuntimeService: DaemonContainerRuntimeService,
        private ownershipService: ContainerOwnershipService,
        private readonly publicPortAllocator: ContainerPublicPortAllocator,
        private readonly relayService: ContainerPortProxyRelayService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    async execute(input: UpdateContainerInputDTO): Promise<Result<UpdateContainerOutputDTO>> {
        const { containerId, teamId, action, env, ports } = input;

        const container = await this.ownershipService.getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        if (action) {
            let runtimeContainer: RuntimeContainerInfo | null = null;
            if (action === 'start') {
                runtimeContainer = await this.containerRuntimeService.startContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'running';
            } else if (action === 'stop') {
                runtimeContainer = await this.containerRuntimeService.stopContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'exited';
            } else if (action === 'restart') {
                runtimeContainer = await this.containerRuntimeService.restartContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'running';
            }

            const internalIp = runtimeContainer ? this.resolveInternalIp(runtimeContainer) : undefined;
            if (internalIp) {
                container.internalIp = internalIp;
            }

            await this.repository.updateById(containerId, {
                status: container.status,
                ...(internalIp ? { internalIp } : {})
            });

            if (internalIp && (action === 'start' || action === 'restart')) {
                await this.relayService.ensureContainerRelays(container.ports
                    .filter((port) => typeof port.public === 'number' && port.public > 0)
                    .map((port) => ({
                        teamId,
                        containerId: container._id,
                        teamClusterId,
                        internalIp,
                        privatePort: port.private,
                        publicPort: port.public as number
                    })));
            }

            await this.publishContainerUpdatedEvent(containerId, teamId, container.name);

            return Result.ok({ container, status: container.status });
        }

        const effectiveEnv = env || container.env;
        let reservedPublicPorts: number[] = [];
        const updateData: {
            env: ContainerEnvironmentVariable[];
            ports?: ContainerPortMapping[];
        } = {
            env: effectiveEnv
        };
        let nextRelays: Array<{
            teamId: string;
            containerId: string;
            teamClusterId: string;
            internalIp: string;
            privatePort: number;
            publicPort: number;
        }> = [];
        let newPublicPorts: number[] = [];

        if (ports) {
            const resolvedPorts = await this.resolveUpdatedPorts(ports, container.ports, container._id);
            updateData.ports = resolvedPorts.ports;
            reservedPublicPorts = resolvedPorts.reservedPublicPorts;
            const existingPublicPorts = new Set(container.ports
                .map((port) => port.public)
                .filter((port): port is number => typeof port === 'number' && port > 0));
            const internalIp = this.requireInternalIp(container.internalIp);

            nextRelays = updateData.ports.map((port) => ({
                teamId,
                containerId: container._id,
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
                await this.relayService.ensureContainerRelays(nextRelays);
            }

            const updated = await this.repository.updateById(containerId, updateData);
            this.publicPortAllocator.commitReservations(reservedPublicPorts);

            if (updateData.ports) {
                await this.relayService.syncContainerRelays(container._id, nextRelays);
            }

            await this.publishContainerUpdatedEvent(containerId, teamId, updated?.name ?? container.name);

            return Result.ok({ container: updated });
        } catch (error) {
            this.publicPortAllocator.releaseReservations(reservedPublicPorts);
            await this.relayService.stopPublicPortRelays(newPublicPorts).catch(() => undefined);
            throw error;
        }
    }

    private async publishContainerUpdatedEvent(containerId: string, teamId: string, containerName: string): Promise<void> {
        await this.eventBus.publish(new ContainerUpdatedEvent({
            containerId,
            teamId,
            containerName
        }));
    }

    private async resolveUpdatedPorts(
        requestedPorts: ContainerPortMapping[],
        existingPorts: ContainerPortMapping[],
        containerId: string
    ): Promise<{ ports: ContainerPortMapping[]; reservedPublicPorts: number[]; }> {
        const existingPortsByPrivatePort = new Map(
            existingPorts.map((port) => [port.private, port])
        );
        const requestedPrivatePorts = new Set<number>();
        const requestedPublicPorts = new Set<number>();
        const resolvedPorts: ContainerPortMapping[] = [];
        const reservedPublicPorts: number[] = [];

        try {
            for (const requestedPort of requestedPorts) {
                if (requestedPrivatePorts.has(requestedPort.private)) {
                    throw ApplicationError.badRequest(
                        ErrorCodes.VALIDATION_INVALID_INPUT,
                        `Container port ${requestedPort.private} is declared more than once`
                    );
                }

                requestedPrivatePorts.add(requestedPort.private);

                const existingPort = existingPortsByPrivatePort.get(requestedPort.private);
                if (existingPort?.public && requestedPort.public === undefined) {
                    this.assertUniqueResolvedPublicPort(existingPort.public, requestedPublicPorts);
                    resolvedPorts.push({
                        private: requestedPort.private,
                        public: existingPort.public
                    });
                    continue;
                }

                if (existingPort?.public && requestedPort.public === existingPort.public) {
                    this.assertUniqueResolvedPublicPort(existingPort.public, requestedPublicPorts);
                    resolvedPorts.push({
                        private: requestedPort.private,
                        public: existingPort.public
                    });
                    continue;
                }

                const reservedPortMapping = await this.publicPortAllocator.reservePortMappings([requestedPort], {
                    excludeContainerId: containerId
                });
                reservedPublicPorts.push(...reservedPortMapping.reservedPublicPorts);
                this.assertUniqueResolvedPublicPort(reservedPortMapping.ports[0].public as number, requestedPublicPorts);
                resolvedPorts.push(reservedPortMapping.ports[0]);
            }

            return {
                ports: resolvedPorts,
                reservedPublicPorts
            };
        } catch (error) {
            this.publicPortAllocator.releaseReservations(reservedPublicPorts);
            throw error;
        }
    }

    private assertUniqueResolvedPublicPort(publicPort: number, requestedPublicPorts: Set<number>): void {
        if (requestedPublicPorts.has(publicPort)) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Public port ${publicPort} is declared more than once`
            );
        }

        requestedPublicPorts.add(publicPort);
    }

    private requireInternalIp(internalIp?: string): string {
        if (!internalIp) {
            throw ApplicationError.conflict(
                'Container::PortUnavailable',
                'Container networking is not ready yet'
            );
        }

        return internalIp;
    }

    private resolveInternalIp(runtimeContainer: RuntimeContainerInfo): string | undefined {
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

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
}
