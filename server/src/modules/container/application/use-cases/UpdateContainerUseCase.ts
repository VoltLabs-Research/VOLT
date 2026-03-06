import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/port/Result';
import { UpdateContainerInputDTO, UpdateContainerOutputDTO } from '@modules/container/application/dtos/UpdateContainerDTO';
import { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import { IContainerService } from '@modules/container/domain/port/IContainerService';
import { IDockerNetworkRepository } from '@modules/container/domain/port/IDockerNetworkRepository';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';

interface PortBinding {
    HostPort: string;
}

@injectable()
export class UpdateContainerUseCase implements IUseCase<UpdateContainerInputDTO, UpdateContainerOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService,
        @inject('IDockerNetworkRepository') private networkRepository: IDockerNetworkRepository
    ){}

    async execute(input: UpdateContainerInputDTO): Promise<Result<UpdateContainerOutputDTO>> {
        const { containerId, action, env, ports } = input;

        const container = await this.repository.findById(containerId);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

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

        // Configuration Update (Requires Recreation)
        // 1. Commit current state
        const sanitizedName = container.name.replace(/\s+/g, '-').toLowerCase();
        const tempImageName = `Volt-temp-${sanitizedName}:${Date.now()}`;
        const [repo, tag] = tempImageName.split(':');
        await this.containerService.commitContainer(container.containerId, repo, tag);

        // 2. Stop and Remove old container
        await this.containerService.removeContainer(container.containerId);

        // 3. Prepare new config
        const effectiveEnv = env || container.env;
        const formattedEnv = effectiveEnv.map((entry) => `${entry.key}=${entry.value}`);

        const portBindings: Record<string, PortBinding[]> = {};
        const exposedPorts: Record<string, Record<string, never>> = {};

        const effectivePorts = ports || container.ports;
        if (effectivePorts) {
            effectivePorts.forEach((portMapping) => {
                const portKey = `${portMapping.private}/tcp`;
                exposedPorts[portKey] = {};
                portBindings[portKey] = [{ HostPort: String(portMapping.public) }];
            });
        }

        // Reuse volume
        const volumeName = `Volt-${sanitizedName}-data`;

        const memoryBytes = container.memory * 1024 * 1024;
        const nanoCpus = container.cpus * 1_000_000_000;

        const hostConfig: Record<string, unknown> = {
            PortBindings: portBindings,
            Memory: memoryBytes,
            NanoCpus: nanoCpus,
            Binds: [`${volumeName}:/data`],
            Tty: true
        };

        const uniqueName = `${container.name.replace(/\s+/g, '-')}-${Date.now()}`;
        const dockerConfig = {
            Image: tempImageName,
            name: uniqueName,
            Env: formattedEnv,
            ExposedPorts: exposedPorts,
            HostConfig: hostConfig,
            Tty: true,
        };

        const newContainerInfo = await this.containerService.createContainer(dockerConfig);
        await this.containerService.startContainer(newContainerInfo.Id);

        // Reconnect network via repository instead of direct model access
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
}
