import { ErrorCodes } from '@core/constants/error-codes';
import { CreateContainerInputDTO, CreateContainerOutputDTO } from '@modules/container/application/dtos/CreateContainerDTO';
import type { ContainerPortMapping, RuntimeContainerInfo } from '@modules/container/domain/port/IContainerService';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import ContainerCreatedEvent from '@modules/container/domain/events/ContainerCreatedEvent';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import type { ISystemMetricsRepository } from '@modules/system/domain/port/ISystemMetricsRepository';
import { SYSTEM_TOKENS } from '@modules/system/infrastructure/di/SystemTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

const MB_PER_GB = 1024;

@injectable()
export class CreateContainerUseCase implements IUseCase<CreateContainerInputDTO, CreateContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerFolderRepository) private readonly folderRepository: IContainerFolderRepository,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(TeamClusterSelectionService) private readonly teamClusterSelectionService: TeamClusterSelectionService,
        @inject(SYSTEM_TOKENS.SystemMetricsRepository) private readonly systemMetricsRepository: ISystemMetricsRepository,
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

    private resolveCanonicalPorts(
        requestedPorts: ContainerPortMapping[] | undefined,
        runtimeContainer: RuntimeContainerInfo
    ): ContainerPortMapping[] {
        if (!requestedPorts || requestedPorts.length === 0) {
            return [];
        }

        const runtimeBindings = runtimeContainer.NetworkSettings?.Ports;

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

            return {
                private: requestedPort.private
            };
        });
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

        const dockerConfig = this.buildContainerRuntimeConfig({
            image,
            name,
            env,
            ports,
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
        const dockerId = containerInfo.Id;
        const runtimeContainer = await this.containerRuntimeService.getContainer(teamClusterId, dockerId);
        const resolvedPorts = this.resolveCanonicalPorts(ports, runtimeContainer);
        const internalIp = this.resolveInternalIp(runtimeContainer);

        const container = await this.repository.create({
            name,
            image,
            containerId: dockerId,
            folder: input.folderId ?? null,
            status: runtimeContainer.State?.Status || containerInfo.State?.Status || 'running',
            memory: memoryInMegabytes,
            cpus: cpuCount,
            env: env || [],
            ports: resolvedPorts,
            createdBy: input.userId,
            team: input.teamId,
            teamCluster: teamClusterId,
            mountDockerSocket: mountDockerSocket || false,
            ...(internalIp ? { internalIp } : {})
        });

        await this.eventBus.publish(new ContainerCreatedEvent({
            containerId: container._id,
            teamId: input.teamId,
            name,
            userId: input.userId
        }));

        return Result.ok({ container });
    }
};
