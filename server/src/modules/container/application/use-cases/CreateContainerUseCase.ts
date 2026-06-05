import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import type SystemMetricsRedisRepository from '@modules/system/infrastructure/persistence/redis/SystemMetricsRedisRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import { ErrorCodes } from '@core/constants/error-codes';
import { CreateContainerInputDTO, CreateContainerOutputDTO } from '@modules/container/application/dtos/CreateContainerDTO';
import ContainerCreatedEvent from '@modules/container/domain/events/ContainerCreatedEvent';
import type { ContainerPortMapping, RuntimeContainerInfo } from '@modules/container/domain/port/IContainerService';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import type { IContainerPortProxyRelayService } from '@modules/container/domain/port/IContainerPortProxyRelayService';
import type { IContainerPublicPortAllocator } from '@modules/container/domain/port/IContainerPublicPortAllocator';
import type { ITeamClusterSelectionService } from '@modules/container/domain/port/ITeamClusterSelectionService';
import ApplicationError from '@shared/application/errors/ApplicationError';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

const MB_PER_GB = 1024;

@injectable()
export class CreateContainerUseCase implements IUseCase<CreateContainerInputDTO, CreateContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private readonly repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerFolderRepository) private readonly folderRepository: IContainerFolderRepository,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private readonly containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(CONTAINER_TOKENS.ContainerPublicPortAllocator) private readonly publicPortAllocator: IContainerPublicPortAllocator,
        @inject(CONTAINER_TOKENS.ContainerPortProxyRelayService) private readonly relayService: IContainerPortProxyRelayService,
        @inject(CONTAINER_TOKENS.TeamClusterSelectionService) private readonly teamClusterSelectionService: ITeamClusterSelectionService,
        @inject(SYSTEM_TOKENS.SystemMetricsRepository) private readonly systemMetricsRepository: SystemMetricsRedisRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    private buildContainerRuntimeConfig(
        input: Pick<CreateContainerInputDTO, 'image' | 'name' | 'env' | 'ports' | 'teamId' | 'operationId'> & {
            teamClusterId: string;
        },
        options: {
            memoryInMegabytes: number;
            cpus: number;
            binds: string[];
            groupAdd: string[];
            cmd?: string[];
            user?: string;
        }
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

    private async validateClusterResourceLimits(teamClusterId: string, memoryInMegabytes: number, cpuCount: number): Promise<void> {
        const metrics = await this.systemMetricsRepository.getLatestByClusterId(teamClusterId);
        if (!metrics) {
            return;
        }

        const maxCpus = metrics.cpu.cores;
        const maxMemoryInMegabytes = Math.floor(metrics.memory.total * MB_PER_GB);

        if (cpuCount > maxCpus) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Requested CPU allocation exceeds cluster capacity (${maxCpus} vCPU max)`
            );
        }

        if (memoryInMegabytes > maxMemoryInMegabytes) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `Requested memory allocation exceeds cluster capacity (${maxMemoryInMegabytes} MB max)`
            );
        }
    }

    private requireInternalIp(runtimeContainer: RuntimeContainerInfo): string {
        const internalIp = this.resolveInternalIp(runtimeContainer);
        if (!internalIp) {
            throw ApplicationError.conflict(
                'Container::NetworkingUnavailable',
                'Container networking is not ready'
            );
        }

        return internalIp;
    }

    private toRuntimePorts(ports: ContainerPortMapping[]): ContainerPortMapping[] {
        return ports.map((port) => ({
            private: port.private
        }));
    }

    async execute(input: CreateContainerInputDTO): Promise<Result<CreateContainerOutputDTO>> {
        const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd, memory, cpus } = input;

        if (!input.userId.trim()) {
            return Result.fail(ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                'Actor userId is required'
            ));
        }

        if (input.folderId) {
            const folder = await this.folderRepository.findByTeamAndFolderId(input.teamId, input.folderId);
            if (!folder) {
                return Result.fail(ApplicationError.notFound(
                    ErrorCodes.RESOURCE_NOT_FOUND,
                    'Target container folder not found'
                ));
            }
        }

        const teamClusterId = await this.teamClusterSelectionService.resolveConnectedClusterId(input.teamId, input.teamClusterId);

        let containerCmd = cmd && Array.isArray(cmd) && cmd.length > 0 ? cmd : undefined;
        if (!containerCmd && !useImageCmd) {
            containerCmd = ['tail', '-f', '/dev/null'];
        }

        const memoryInMegabytes = memory || 512;
        const cpuCount = cpus || 1;
        await this.validateClusterResourceLimits(teamClusterId, memoryInMegabytes, cpuCount);

        const sanitizedName = name.replace(/\s+/g, '-').toLowerCase();
        const binds: string[] = [`Volt-${sanitizedName}-data:/data`];
        const groupAdd: string[] = [];

        if (mountDockerSocket) {
            binds.push('/var/run/docker.sock:/var/run/docker.sock');
        }

        const reservedPortMappings = await this.publicPortAllocator.reservePortMappings(ports);
        const assignedPorts = reservedPortMappings.ports;
        let dockerId: string | null = null;
        let persistedContainerId: string | null = null;

        try {
            const dockerConfig = this.buildContainerRuntimeConfig({
                image,
                name,
                env,
                ports: this.toRuntimePorts(assignedPorts),
                teamId: input.teamId,
                teamClusterId
            }, {
                memoryInMegabytes,
                cpus: cpuCount,
                binds,
                groupAdd,
                cmd: containerCmd
            });

            const containerInfo = await this.containerRuntimeService.createContainer(teamClusterId, dockerConfig);
            dockerId = containerInfo.Id;
            const runtimeContainer = await this.containerRuntimeService.getContainer(teamClusterId, dockerId);
            const internalIp = this.requireInternalIp(runtimeContainer);

            const container = await this.repository.create({
                name,
                image,
                containerId: dockerId,
                folder: input.folderId ?? null,
                status: runtimeContainer.State?.Status || containerInfo.State?.Status || 'running',
                memory: memoryInMegabytes,
                cpus: cpuCount,
                env: env || [],
                ports: assignedPorts,
                createdBy: input.userId,
                team: input.teamId,
                teamCluster: teamClusterId,
                mountDockerSocket: mountDockerSocket || false,
                internalIp
            });
            persistedContainerId = container._id;

            await this.relayService.ensureContainerRelays(assignedPorts.map((port) => ({
                teamId: input.teamId,
                containerId: container._id,
                teamClusterId,
                internalIp,
                privatePort: port.private,
                publicPort: port.public as number
            })));
            this.publicPortAllocator.commitReservations(reservedPortMappings.reservedPublicPorts);

            await this.eventBus.publish(new ContainerCreatedEvent({
                containerId: container._id,
                teamId: input.teamId,
                name,
                userId: input.userId
            }));

            return Result.ok({ container });
        } catch (error) {
            this.publicPortAllocator.releaseReservations(reservedPortMappings.reservedPublicPorts);

            if (persistedContainerId) {
                await this.repository.deleteById(persistedContainerId).catch(() => undefined);
                await this.relayService.stopContainerRelays(persistedContainerId).catch(() => undefined);
            }

            if (dockerId) {
                await this.containerRuntimeService.removeContainer(teamClusterId, dockerId).catch(() => undefined);
            }

            throw error;
        }
    }
}
