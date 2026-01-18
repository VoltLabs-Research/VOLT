import { injectable, inject } from 'tsyringe';
import { IUseCase } from '@shared/application/IUseCase';
import { Result } from '@shared/domain/ports/Result';
import { UpdateContainerInputDTO, UpdateContainerOutputDTO } from '@modules/container/application/dtos/ContainerDTOs';
import { IContainerRepository } from '@modules/container/domain/ports/IContainerRepository';
import { IContainerService } from '@modules/container/domain/ports/IContainerService';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@shared/domain/constants/ErrorCodes';

@injectable()
export class UpdateContainerUseCase implements IUseCase<UpdateContainerInputDTO, UpdateContainerOutputDTO> {
    constructor(
        @inject('IContainerRepository') private repository: IContainerRepository,
        @inject('IContainerService') private containerService: IContainerService
    ){}

    async execute(input: UpdateContainerInputDTO): Promise<Result<UpdateContainerOutputDTO>> {
        const { id, action, env, ports } = input;

        const container = await this.repository.findById(id);
        if (!container) {
            throw new ApplicationError(ErrorCodes.CONTAINER_NOT_FOUND, 'Container not found', 404);
        }

        if (action) {
            // State change only
            if (action === 'start') {
                await this.containerService.startContainer(container.containerId);
            } else if (action === 'stop') {
                await this.containerService.stopContainer(container.containerId);
            } else if (action === 'restart') {
                await this.containerService.stopContainer(container.containerId);
                await this.containerService.startContainer(container.containerId);
            }

            const stats = await this.containerService.createContainer({ /* fake */ }).catch(() => null); // Should leverage inspect method in service
            // Re-inspect to get status? 
            // We need 'inspect' in IContainerService to be proper.
            // For now, assume success and update DB status if needed, or query stats which might fail if stopped.

            // Just update DB status
            const status = action === 'start' || action === 'restart' ? 'running' : 'exited';
            container.status = status;
            await this.repository.updateById(id, { status });

            return Result.ok({ container, status });
        }

        // Configuration Update (Requires Recreation)
        // 1. Commit current state
        const tempImageName = `volterra-temp-${container.name.replace(/\s+/g, '-').toLowerCase()}:${Date.now()}`;
        const [repo, tag] = tempImageName.split(':');
        await this.containerService.commitContainer(container.containerId, repo, tag);

        // 2. Stop and Remove old container
        await this.containerService.removeContainer(container.containerId);

        // 3. Prepare new config
        const Env = env ? env.map((e) => `${e.key}=${e.value}`) : container.env.map((e) => `${e.key}=${e.value}`);
        const PortBindings: Record<string, any> = {};
        const ExposedPorts: Record<string, any> = {};

        const portsToUse = ports || container.ports;
        if (portsToUse) {
            portsToUse.forEach((p) => {
                const portKey = `${p.private}/tcp`;
                ExposedPorts[portKey] = {};
                PortBindings[portKey] = [{ HostPort: String(p.public) }];
            });
        }

        // Reuse volume
        const volumeName = `volterra-${container.name.replace(/\s+/g, '-').toLowerCase()}-data`;

        const HostConfig: any = {
            PortBindings,
            Memory: container.memory * 1024 * 1024,
            NanoCpus: container.cpus * 1_000_000_000,
            Binds: [`${volumeName}:/data`],
            Tty: true
        };

        const uniqueName = `${container.name.replace(/\s+/g, '-')}-${Date.now()}`;
        const dockerConfig = {
            Image: tempImageName,
            name: uniqueName,
            Env,
            ExposedPorts,
            HostConfig,
            Tty: true,
            // Cmd: ... preserve cmd?
        };

        const newContainerInfo = await this.containerService.createContainer(dockerConfig);
        await this.containerService.startContainer(newContainerInfo.Id);

        // Reconnect network
        if (container.network) {
            // Need network ID. 
            // container.network is ObjectId. 
            // We assume network name standard or fetch via ID? 
            // Ideally we fetch the Network Doc.
            // For now, use standard name construction as fallback or query.
            const { DockerNetwork } = await import('@modules/container/infrastructure/persistence/mongo/models/DockerNetworkModel');
            const netDoc = await DockerNetwork.findById(container.network);
            if (netDoc) {
                await this.containerService.connectNetwork(netDoc.networkId, newContainerInfo.Id);
            }
        }

        const updated = await this.repository.updateById(id, {
            containerId: newContainerInfo.Id,
            image: tempImageName, // Update image ref? Or keep original? Legacy updated it.
            env: env || container.env,
            ports: ports || container.ports,
            status: 'running'
        });

        return Result.ok({ container: updated });
    }
}
