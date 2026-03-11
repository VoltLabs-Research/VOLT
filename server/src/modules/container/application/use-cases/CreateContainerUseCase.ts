import { ErrorCodes } from '@core/constants/error-codes';
import { CreateContainerInputDTO, CreateContainerOutputDTO } from '@modules/container/application/dtos/CreateContainerDTO';
import type { ContainerCapabilities } from '@modules/container/domain/entities/ContainerCapabilities';
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

const XRDP_PRIVATE_PORT = 3389;

@injectable()
export class CreateContainerUseCase implements IUseCase<CreateContainerInputDTO, CreateContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
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
        if (!input.capabilities?.xrdp) {
            return undefined;
        }

        const exposesXrdpPort = (input.ports || []).some((port) => port.private === XRDP_PRIVATE_PORT);
        if (!exposesXrdpPort) {
            throw ApplicationError.badRequest(
                ErrorCodes.VALIDATION_INVALID_INPUT,
                `XRDP-capable containers must expose private port ${XRDP_PRIVATE_PORT}`
            );
        }

        return {
            xrdp: true
        };
    }

    async execute(input: CreateContainerInputDTO): Promise<Result<CreateContainerOutputDTO>> {
        const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd, memory, cpus } = input;
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

            const container = await this.repository.create({
                name,
                image,
                containerId: dockerId,
                folder: input.folderId ?? null,
                status: containerInfo.State?.Status || 'running',
                memory: memoryInMegabytes,
            cpus: cpuCount,
            env: env || [],
            ports: ports || [],
            createdBy: input.userId,
            team: input.teamId,
            teamCluster: teamClusterId,
            mountDockerSocket: mountDockerSocket || false,
            internalIp: containerInfo.NetworkSettings?.IPAddress || '0.0.0.0',
            capabilities
        });

        await this.eventBus.publish(new ContainerCreatedEvent({
            containerId: container._id,
            teamId: input.teamId,
            name
        }));

        return Result.ok({ container });
    }
};
