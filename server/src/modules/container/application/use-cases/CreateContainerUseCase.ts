import { injectable, inject } from 'tsyringe';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { CreateContainerInputDTO, CreateContainerOutputDTO } from '@modules/container/application/dtos/CreateContainerDTO';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IDockerNetworkRepository } from '@modules/container/domain/port/IDockerNetworkRepository';
import { IDockerVolumeRepository } from '@modules/container/domain/port/IDockerVolumeRepository';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import { IEventBus } from '@shared/application/events/IEventBus';
import ContainerCreatedEvent from '@modules/container/domain/events/ContainerCreatedEvent';

const execAsync = promisify(execCallback);

interface PortBinding {
    HostPort: string;
}

@injectable()
export class CreateContainerUseCase implements IUseCase<CreateContainerInputDTO, CreateContainerOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService,
        @inject('IDockerNetworkRepository') private networkRepository: IDockerNetworkRepository,
        @inject('IDockerVolumeRepository') private volumeRepository: IDockerVolumeRepository,
        @inject(SHARED_TOKENS.EventBus) private readonly eventBus: IEventBus
    ){}

    async execute(input: CreateContainerInputDTO): Promise<Result<CreateContainerOutputDTO>> {
        const { name, image, env, ports, cmd, mountDockerSocket, useImageCmd, memory, cpus } = input;

        const formattedEnv = env
            ? env.map((entry) => `${entry.key}=${entry.value}`)
            : [];
        const portBindings: Record<string, PortBinding[]> = {};
        const exposedPorts: Record<string, Record<string, never>> = {};

        if (ports) {
            ports.forEach((portMapping) => {
                const portKey = `${portMapping.private}/tcp`;
                exposedPorts[portKey] = {};
                portBindings[portKey] = [{ HostPort: String(portMapping.public) }];
            });
        }

        let containerCmd = cmd && Array.isArray(cmd) && cmd.length > 0 ? cmd : undefined;
        if (!containerCmd && !useImageCmd) {
            containerCmd = ['tail', '-f', '/dev/null'];
        }

        const memoryBytes = (memory || 512) * 1024 * 1024;
        const nanoCpus = (cpus || 1) * 1_000_000_000;

        const hostConfig: Record<string, unknown> = {
            PortBindings: portBindings,
            Memory: memoryBytes,
            NanoCpus: nanoCpus
        };

        // Create Volume
        const { id: dockerVolumeId, name: volumeName } = await this.containerService.createVolume(name);
        const binds: string[] = [`${volumeName}:/data`];

        if (mountDockerSocket) {
            binds.push('/var/run/docker.sock:/var/run/docker.sock');
            try {
                const { stdout } = await execAsync('getent group docker | cut -d: -f3');
                const dockerGid = stdout.trim();
                if (dockerGid) {
                    hostConfig.GroupAdd = [dockerGid];
                }
            } catch {
                // ignore - docker group may not exist
            }
        }

        hostConfig.Binds = binds;

        const sanitizedName = name.replace(/\s+/g, '-');
        const uniqueName = `${sanitizedName}-${Date.now()}`;
        const dockerConfig = {
            Image: image,
            name: uniqueName,
            Env: formattedEnv,
            ExposedPorts: exposedPorts,
            HostConfig: hostConfig,
            Tty: true,
            Cmd: containerCmd
        };

        await this.containerService.ensureImage(image);
        const containerInfo = await this.containerService.createContainer(dockerConfig);
        const dockerId = containerInfo.Id;

        await this.containerService.startContainer(dockerId);

        // Network
        const { id: dockerNetworkId, name: networkName } = await this.containerService.createNetwork(name);
        await this.containerService.connectNetwork(dockerNetworkId, dockerId);

        await this.containerService.getStats(dockerId).catch(() => null);

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
            memory: memory || 512,
            cpus: cpus || 1,
            env: env || [],
            ports: ports || [],
            createdBy: input.userId,
            team: input.teamId,
            network: networkDocument.id,
            volume: volumeDocument.id,
            internalIp: '0.0.0.0'
        });

        await this.eventBus.publish(new ContainerCreatedEvent({
            containerId: container.id,
            teamId: input.teamId,
            name
        }));

        return Result.ok({ container });
    }
}
