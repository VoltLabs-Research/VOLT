import { ErrorCodes } from '@core/constants/error-codes';
import { CreateContainerInputDTO, CreateContainerOutputDTO } from '@modules/container/application/dtos/CreateContainerDTO';
import type { ContainerCapabilities } from '@modules/container/domain/entities/ContainerCapabilities';
import type { ContainerPortMapping, RuntimeContainerInfo } from '@modules/container/domain/port/IContainerService';
import type { IContainerFolderRepository } from '@modules/container/domain/port/IContainerFolderRepository';
import ContainerCreatedEvent from '@modules/container/domain/events/ContainerCreatedEvent';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import type { ITeamClusterContainerRuntimeService } from '@modules/container/domain/port/ITeamClusterContainerRuntimeService';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { TeamClusterSelectionService } from '@modules/container/infrastructure/services/TeamClusterSelectionService';
import { IEventBus } from '@shared/application/events/IEventBus';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

const VNC_PRIVATE_PORT = 5901;
const VNC_PASSWORD_ENV_KEY = 'VNC_PW';

@injectable()
export class CreateContainerUseCase implements IUseCase<CreateContainerInputDTO, CreateContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerFolderRepository) private readonly folderRepository: IContainerFolderRepository,
        @inject(CONTAINER_TOKENS.ContainerRuntimeService) private containerRuntimeService: ITeamClusterContainerRuntimeService,
        @inject(TeamClusterSelectionService) private readonly teamClusterSelectionService: TeamClusterSelectionService,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    private buildContainerRuntimeConfig(
        input: Pick<CreateContainerInputDTO, 'image' | 'name' | 'env' | 'ports' | 'teamId'> & {
            teamClusterId: string;
        },
        options: {
            memoryInMegabytes: number;
            cpus: number;
            binds: string[];
            groupAdd: string[];
            cmd?: string[];
        }
    ) {
        const sanitizedName = input.name.replace(/\s+/g, '-');
        return {
            image: input.image,
            name: `${sanitizedName}-${Date.now()}`,
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
            cmd: options.cmd
        };
    }

    private resolveCapabilities(input: CreateContainerInputDTO): ContainerCapabilities | undefined {
        if (!input.capabilities?.vnc) {
            return undefined;
        }

        const exposesVncPort = (input.ports || []).some((port) => port.private === VNC_PRIVATE_PORT);
        if (!exposesVncPort) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `VNC-capable containers must expose private port ${VNC_PRIVATE_PORT}`
            );
        }

        this.validateVncPassword(input);

        return {
            vnc: true
        };
    }

    private validateVncPassword(input: CreateContainerInputDTO): void {
        const vncPasswordEntries = (input.env || []).filter((environmentVariable) => environmentVariable.key === VNC_PASSWORD_ENV_KEY);

        if (vncPasswordEntries.length === 0) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `VNC-capable containers must define env var ${VNC_PASSWORD_ENV_KEY}`
            );
        }

        if (vncPasswordEntries.length > 1) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `VNC-capable containers must define env var ${VNC_PASSWORD_ENV_KEY} only once`
            );
        }

        if (!vncPasswordEntries[0].value.trim()) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `VNC-capable containers must define a non-empty ${VNC_PASSWORD_ENV_KEY} env var`
            );
        }
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

        const teamClusterId = await this.teamClusterSelectionService.resolveTeamClusterId(input.teamId, input.teamClusterId);

        let containerCmd = cmd && Array.isArray(cmd) && cmd.length > 0 ? cmd : undefined;
        if (!containerCmd && !useImageCmd) {
            containerCmd = ['tail', '-f', '/dev/null'];
        }

        const memoryInMegabytes = memory || 512;
        const cpuCount = cpus || 1;
        const capabilities = this.resolveCapabilities(input);

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
            ...(internalIp ? { internalIp } : {}),
            capabilities
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
