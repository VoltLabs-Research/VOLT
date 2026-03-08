import { CreateContainerInputDTO, CreateContainerOutputDTO } from '@modules/container/application/dtos/CreateContainerDTO';
import ContainerCreatedEvent from '@modules/container/domain/events/ContainerCreatedEvent';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IDockerNetworkRepository } from '@modules/container/domain/port/IDockerNetworkRepository';
import { IDockerVolumeRepository } from '@modules/container/domain/port/IDockerVolumeRepository';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { inject, injectable } from 'tsyringe';

@injectable()
export class CreateContainerUseCase implements IUseCase<CreateContainerInputDTO, CreateContainerOutputDTO> {
    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository) private repository: IContainerRepository,
        @inject(CONTAINER_TOKENS.ContainerService) private containerService: IContainerService,
        @inject(CONTAINER_TOKENS.DockerNetworkRepository) private networkRepository: IDockerNetworkRepository,
        @inject(CONTAINER_TOKENS.DockerVolumeRepository) private volumeRepository: IDockerVolumeRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ) {}

    private buildContainerRuntimeConfig(
        input: Pick<CreateContainerInputDTO, 'image' | 'name' | 'env' | 'ports'>,
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
            memoryInMegabytes: options.memoryInMegabytes,
            cpus: options.cpus,
            binds: options.binds,
            groupAdd: options.groupAdd,
            cmd: options.cmd
        };
    }

    async execute(input: CreateContainerInputDTO): Promise<Result<CreateContainerOutputDTO>> {
        const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd, memory, cpus } = input;

        let containerCmd = cmd && Array.isArray(cmd) && cmd.length > 0 ? cmd : undefined;
        if (!containerCmd && !useImageCmd) {
            containerCmd = ['tail', '-f', '/dev/null'];
        }

        const memoryInMegabytes = memory || 512;
        const cpuCount = cpus || 1;

        const { id: dockerVolumeId, name: volumeName } = await this.containerService.createVolume(name);
        const binds: string[] = [`${volumeName}:/data`];
        const groupAdd: string[] = [];

        if (mountDockerSocket) {
            binds.push('/var/run/docker.sock:/var/run/docker.sock');
            groupAdd.push(...await this.containerService.resolveDockerSocketGroupAdd());
        }

        const dockerConfig = this.buildContainerRuntimeConfig({
            image,
            name,
            env,
            ports
        }, {
            memoryInMegabytes,
            cpus: cpuCount,
            binds,
            groupAdd,
            cmd: containerCmd
        });

        await this.containerService.ensureImage(image);
        const containerInfo = await this.containerService.createContainer(dockerConfig);
        const dockerId = containerInfo.Id;

        await this.containerService.startContainer(dockerId);

        // Network
        const { id: dockerNetworkId, name: networkName } = await this.containerService.createNetwork(name);
        await this.containerService.connectNetwork(dockerNetworkId, dockerId);

        // Persist network and volume documents via repositories
        const networkDocument = await this.networkRepository.findOrCreateByNetworkId(
            dockerNetworkId,
            { name: networkName, driver: 'bridge' }
        );

        const volumeDocument = await this.volumeRepository.findOrCreateByVolumeId(
            dockerVolumeId,
            { name: volumeName, driver: 'local' }
        );

        const container = await this.repository.create({
            name,
            image,
            containerId: dockerId,
            status: 'running',
            memory: memoryInMegabytes,
            cpus: cpuCount,
            env: env || [],
            ports: ports || [],
            createdBy: input.userId,
            team: input.teamId,
            network: networkDocument._id,
            volume: volumeDocument._id,
            internalIp: '0.0.0.0'
        });

        await this.eventBus.publish(new ContainerCreatedEvent({
            containerId: container._id,
            teamId: input.teamId,
            name
        }));

        return Result.ok({ container });
    }
};
