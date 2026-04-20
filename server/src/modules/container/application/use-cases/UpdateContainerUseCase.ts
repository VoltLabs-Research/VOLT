import { UpdateContainerInputDTO, UpdateContainerOutputDTO } from '@modules/container/application/dtos/UpdateContainerDTO';
import ContainerUpdatedEvent from '@modules/container/domain/events/ContainerUpdatedEvent';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';
import type {
    ContainerEnvironmentVariable,
    ContainerPortMapping,
    RuntimeContainerInfo
} from '@modules/container/domain/port/IContainerService';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import type { IEventBus } from '@shared/application/events/IEventBus';

@injectable()
export class UpdateContainerUseCase implements IUseCase<UpdateContainerInputDTO, UpdateContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    async execute(input: UpdateContainerInputDTO): Promise<Result<UpdateContainerOutputDTO>> {
        const { containerId, teamId, action, env, ports } = input;

        const container = await this.ownershipService.getOwnedByTeam(containerId, teamId);
        const teamClusterId = this.requireTeamClusterId(container.teamCluster);

        if (action) {
            if (action === 'start') {
                const runtimeContainer = await this.containerRuntimeService.startContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'running';
            } else if (action === 'stop') {
                const runtimeContainer = await this.containerRuntimeService.stopContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'exited';
            } else if (action === 'restart') {
                const runtimeContainer = await this.containerRuntimeService.restartContainer(teamClusterId, container.containerId);
                container.status = runtimeContainer.State?.Status || 'running';
            }

            await this.repository.updateById(containerId, { status: container.status });
            await this.publishContainerUpdatedEvent(containerId, teamId, container.name);

            return Result.ok({ container, status: container.status });
        }

        const effectiveEnv = env || container.env;
        const updateData: {
            env: ContainerEnvironmentVariable[];
            ports?: ContainerPortMapping[];
        } = {
            env: effectiveEnv
        };

        if (ports) {
            const runtimeContainer = await this.containerRuntimeService.getContainer(teamClusterId, container.containerId);
            updateData.ports = this.resolveCanonicalPorts(ports, container.ports, runtimeContainer);
        }

        const updated = await this.repository.updateById(containerId, updateData);
        await this.publishContainerUpdatedEvent(containerId, teamId, updated?.name ?? container.name);

        return Result.ok({ container: updated });
    }

    private async publishContainerUpdatedEvent(containerId: string, teamId: string, containerName: string): Promise<void> {
        await this.eventBus.publish(new ContainerUpdatedEvent({
            containerId,
            teamId,
            containerName
        }));
    }

    private resolveCanonicalPorts(
        requestedPorts: ContainerPortMapping[],
        existingPorts: ContainerPortMapping[],
        runtimeContainer: RuntimeContainerInfo
    ): ContainerPortMapping[] {
        const runtimeBindings = runtimeContainer.NetworkSettings?.Ports;
        const existingPortsByPrivatePort = new Map(
            existingPorts.map((port) => [port.private, port])
        );

        return requestedPorts.map((requestedPort) => {
            const runtimePortBindings = runtimeBindings?.[`${requestedPort.private}/tcp`];
            const runtimePortBinding = Array.isArray(runtimePortBindings) ? runtimePortBindings[0] : undefined;
            const publicPort = Number(runtimePortBinding?.HostPort);

            if (Number.isFinite(publicPort) && publicPort > 0) {
                return {
                    private: requestedPort.private,
                    public: publicPort
                };
            }

            const existingPort = existingPortsByPrivatePort.get(requestedPort.private);
            const persistedPublicPort = existingPort?.public;

            if (typeof persistedPublicPort === 'number' && Number.isFinite(persistedPublicPort) && persistedPublicPort > 0) {
                return {
                    private: requestedPort.private,
                    public: persistedPublicPort
                };
            }

            return {
                private: requestedPort.private
            };
        });
    }

    private requireTeamClusterId(teamClusterId?: string): string {
        if (!teamClusterId) {
            throw ApplicationError.conflict('TeamCluster::Missing', 'Container is not assigned to a team cluster');
        }

        return teamClusterId;
    }
};
