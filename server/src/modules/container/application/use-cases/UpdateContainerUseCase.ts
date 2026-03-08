import { UpdateContainerInputDTO, UpdateContainerOutputDTO } from '@modules/container/application/dtos/UpdateContainerDTO';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { ContainerOwnershipService } from '@modules/container/infrastructure/services/ContainerOwnershipService';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IDockerNetworkRepository } from '@modules/container/domain/port/IDockerNetworkRepository';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { inject, injectable } from 'tsyringe';
import type { ContainerEnvironmentVariable, ContainerPortMapping, CreateRuntimeContainerOptions } from '@modules/container/domain/port/IContainerService';

interface ReplacementContainerConfigInput {
    image: string;
    name: string;
    env: ContainerEnvironmentVariable[];
    ports: ContainerPortMapping[];
    memoryInMegabytes: number;
    cpus: number;
    binds: string[];
};

@injectable()
export class UpdateContainerUseCase implements IUseCase<UpdateContainerInputDTO, UpdateContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerService) private containerService: IContainerService,
        @inject(CONTAINER_TOKENS.DockerNetworkRepository) private networkRepository: IDockerNetworkRepository,
        @inject(ContainerOwnershipService) private ownershipService: ContainerOwnershipService
    ) {}

    private buildReplacementContainerConfig(input: ReplacementContainerConfigInput): CreateRuntimeContainerOptions {
        return {
            image: input.image,
            name: `${input.name.replace(/\s+/g, '-')}-${Date.now()}`,
            env: input.env,
            ports: input.ports,
            memoryInMegabytes: input.memoryInMegabytes,
            cpus: input.cpus,
            binds: input.binds
        };
    }

    async execute(input: UpdateContainerInputDTO): Promise<Result<UpdateContainerOutputDTO>> {
        const { containerId, teamId, action, env, ports } = input;

        const container = await this.ownershipService.getOwnedByTeam(containerId, teamId);

        if (action) {
            if (action === 'start') {
                await this.containerService.startContainer(container.containerId);
            } else if (action === 'stop') {
                await this.containerService.stopContainer(container.containerId);
            } else if (action === 'restart') {
                await this.containerService.stopContainer(container.containerId);
                await this.containerService.startContainer(container.containerId);
            }

            const isRunning = action === 'start' || action === 'restart';
            const status = isRunning ? 'running' : 'exited';
            container.status = status;
            await this.repository.updateById(containerId, { status });

            return Result.ok({ container, status });
        }

        const sanitizedName = container.name.replace(/\s+/g, '-').toLowerCase();
        const tempImageName = `Volt-temp-${sanitizedName}:${Date.now()}`;
        const [repo, tag] = tempImageName.split(':');
        await this.containerService.commitContainer(container.containerId, repo, tag);

        await this.containerService.removeContainer(container.containerId);

        const effectivePorts = ports || container.ports;
        const volumeName = `Volt-${sanitizedName}-data`;
        const effectiveEnv = env || container.env;

        const dockerConfig = this.buildReplacementContainerConfig({
            image: tempImageName,
            name: container.name,
            env: effectiveEnv,
            ports: effectivePorts,
            memoryInMegabytes: container.memory,
            cpus: container.cpus,
            binds: [`${volumeName}:/data`]
        });

        const newContainerInfo = await this.containerService.createContainer(dockerConfig);
        await this.containerService.startContainer(newContainerInfo.Id);

        if (container.network) {
            const networkDocument = await this.networkRepository.findById(container.network);
            if (networkDocument) {
                await this.containerService.connectNetwork(networkDocument.networkId, newContainerInfo.Id);
            }
        }

        const updated = await this.repository.updateById(containerId, {
            containerId: newContainerInfo.Id,
            image: tempImageName,
            env: effectiveEnv,
            ports: effectivePorts,
            status: 'running'
        });

        return Result.ok({ container: updated });
    }
};
