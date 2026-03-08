import { inject, injectable } from 'tsyringe';
import ApplicationError from '@shared/application/errors/ApplicationErrors';
import { ErrorCodes } from '@core/constants/error-codes';
import { CONTAINER_TOKENS } from '@modules/container/infrastructure/di/ContainerTokens';
import type { IContainerRepository } from '@modules/container/domain/port/IContainerRepository';
import type { IContainerService } from '@modules/container/domain/port/IContainerService';
import type { IDockerNetworkRepository } from '@modules/container/domain/port/IDockerNetworkRepository';
import type { IDockerVolumeRepository } from '@modules/container/domain/port/IDockerVolumeRepository';
import type { Container } from '@modules/container/domain/entities/Container';
import ContainerCreatedEvent from '@modules/container/domain/events/ContainerCreatedEvent';
import { SHARED_TOKENS } from '@shared/infrastructure/di/SharedTokens';
import type { IEventBus } from '@shared/application/events/IEventBus';
import { getJupyterRuntimeConfig } from '../utilities/jupyter-runtime-config';

export interface EnsureJupyterContainerResult {
    container: Container;
    hostPort: number;
}

@injectable()
export class JupyterContainerManager {
    private readonly runtime = getJupyterRuntimeConfig();

    constructor(
        @inject(CONTAINER_TOKENS.ContainerRepository)
        private readonly containerRepository: IContainerRepository,

        @inject(CONTAINER_TOKENS.ContainerService)
        private readonly containerService: IContainerService,

        @inject(CONTAINER_TOKENS.DockerNetworkRepository)
        private readonly networkRepository: IDockerNetworkRepository,

        @inject(CONTAINER_TOKENS.DockerVolumeRepository)
        private readonly volumeRepository: IDockerVolumeRepository,

        @inject(SHARED_TOKENS.EventBus)
        private readonly eventBus: IEventBus
    ) {}

    async ensureContainer(teamId: string, trajectoryId: string, userId: string): Promise<EnsureJupyterContainerResult> {
        const containerName = trajectoryId;
        const existingContainer = await this.containerRepository.findOne({
            team: teamId,
            name: containerName
        });

        if (existingContainer) {
            const reused = await this.tryReuseExistingContainer(existingContainer);
            if (reused) {
                return reused;
            }

            await this.removeBrokenContainer(existingContainer);
        }

        return this.createContainer(teamId, userId, containerName);
    }

    async deleteSession(trajectoryId: string): Promise<void> {
        const existingContainers = await this.containerRepository.findAll({
            filter: { name: trajectoryId } as any
        });

        if (existingContainers.data && existingContainers.data.length > 0) {
            await Promise.all(existingContainers.data.map((container) => this.removeBrokenContainer(container)));
        }
    }

    private async tryReuseExistingContainer(container: Container): Promise<EnsureJupyterContainerResult | null> {
        let hostPort = await this.containerService.getPublishedPort(container.containerId, this.runtime.jupyter.port);

        if (!hostPort) {
            await this.containerService.startContainer(container.containerId);
            hostPort = await this.containerService.getPublishedPort(container.containerId, this.runtime.jupyter.port);
        }

        if (!hostPort) {
            return null;
        }

        if (container.status !== 'running' && container._id) {
            await this.containerRepository.updateById(container._id, { status: 'running' });
        }

        return { container, hostPort };
    }

    private async removeBrokenContainer(container: Container): Promise<void> {
        if (container._id) {
            await this.containerRepository.deleteById(container._id);
        }

        await this.containerService.removeContainer(container.containerId);
    }

    private async createContainer(teamId: string, userId: string, containerName: string): Promise<EnsureJupyterContainerResult> {
        const { start, end } = this.runtime.jupyter.hostPortRange;
        const hostPort = await this.containerService.findAvailableHostPort(start, end);

        if (!hostPort) {
            throw new ApplicationError(
                ErrorCodes.DOCKER_CREATE_ERROR,
                'No available host port for the Jupyter container',
                500
            );
        }

        const { id: dockerVolumeId, name: volumeName } = await this.containerService.createVolume(containerName);
        const { id: dockerNetworkId, name: networkName } = await this.containerService.createNetwork(containerName);

        await this.containerService.ensureImage(this.runtime.jupyter.image);

        const containerInfo = await this.containerService.createContainer({
            image: this.runtime.jupyter.image,
            name: containerName,
            env: [],
            ports: [{
                private: this.runtime.jupyter.port,
                public: hostPort
            }],
            memoryInMegabytes: this.runtime.memoryMb,
            cpus: this.runtime.cpus,
            binds: [`${volumeName}:/data`],
            groupAdd: [],
            cmd: ['tail', '-f', '/dev/null']
        });

        const dockerId = (containerInfo as { Id: string }).Id;
        await this.containerService.startContainer(dockerId);
        await this.containerService.connectNetwork(dockerNetworkId, dockerId);

        const networkDocument = await this.networkRepository.findOrCreateByNetworkId(
            dockerNetworkId,
            { name: networkName, driver: 'bridge' }
        );
        const volumeDocument = await this.volumeRepository.findOrCreateByVolumeId(
            dockerVolumeId,
            { name: volumeName, driver: 'local' }
        );

        const container = await this.containerRepository.create({
            name: containerName,
            image: this.runtime.jupyter.image,
            containerId: dockerId,
            status: 'running',
            memory: this.runtime.memoryMb,
            cpus: this.runtime.cpus,
            env: [],
            ports: [{
                private: this.runtime.jupyter.port,
                public: hostPort
            }],
            createdBy: userId,
            team: teamId,
            network: networkDocument._id,
            volume: volumeDocument._id,
            internalIp: '0.0.0.0'
        });

        await this.eventBus.publish(new ContainerCreatedEvent({
            containerId: container._id,
            teamId,
            name: containerName
        }));

        return {
            container,
            hostPort
        };
    }
}
