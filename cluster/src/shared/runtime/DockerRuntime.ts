import { singleton } from '@shared/utilities/singleton';
import { getEventBroker } from '@shared/events/RuntimeEventBroker';
import { getConfig } from '@core/config/daemon';
import { createDockerClient } from '@shared/runtime/docker-client';
import { ensureDockerImage } from '@shared/runtime/docker-image-pull';
import { writeContainerFile } from '@shared/runtime/docker-container-filesystem';
import { TEAM_CLUSTER_ID_LABEL_KEY, VOLT_MANAGED_CONTAINER_LABEL_KEY, VOLT_MANAGED_CONTAINER_LABEL_VALUE } from '@shared/contracts/types/runtime-container';
import { OrchestrationAction } from '@shared/contracts/types/http-runtime';
import { ProgressStageType } from '@voltstack/daemon-cluster-client';
import type { DaemonConfig } from '@core/config/daemon';
import type { DockerExecOptions } from '@shared/runtime/docker-exec';
import type { RuntimeEventBroker } from '@shared/events/RuntimeEventBroker';
import type { CreateContainerRequest } from '@shared/contracts/types/http-container';
import Docker from 'dockerode';

interface DockerContainerFilter {
    label?: string[];
}


export class DockerRuntime {
    private readonly docker: Docker = createDockerClient();
    private readonly tenantLabel: string;

    constructor(
        private readonly eventBroker: RuntimeEventBroker,
        private readonly config: DaemonConfig
    ) {
        this.tenantLabel = this.config.teamClusterId;
    }

    private mergeTenantFilter(filters?: DockerContainerFilter): DockerContainerFilter {
        const tenantSelector = `${TEAM_CLUSTER_ID_LABEL_KEY}=${this.tenantLabel}`;
        const existingLabels = filters?.label ?? [];
        if (existingLabels.includes(tenantSelector)) {
            return filters ?? { label: [tenantSelector] };
        }
        return {
            ...filters,
            label: [...existingLabels, tenantSelector]
        };
    }

    readonly listContainers = (all: boolean = true, filters?: DockerContainerFilter): Promise<Docker.ContainerInfo[]> => {
        const scopedFilters = this.mergeTenantFilter(filters);
        return this.docker.listContainers({
            all,
            filters: JSON.stringify(scopedFilters)
        });
    };

    readonly getContainer = async (containerId: string): Promise<Docker.ContainerInspectInfo> => {
        const info = await this.docker.getContainer(containerId).inspect();
        const labelValue = info.Config?.Labels?.[TEAM_CLUSTER_ID_LABEL_KEY];
        if (labelValue !== this.tenantLabel) {
            throw new Error(`Container ${containerId} is not owned by this tenant`);
        }
        return info;
    };

    private getPortsFromRequest(input: CreateContainerRequest){
        const exposedPorts: Record<string, Record<string, never>> = {};
        const portBindings: Record<string, { HostPort: string }[]> = {};

        for(const port of input.ports ?? []){
            const key = `${port.private}/tcp`;
            exposedPorts[key] = {};

            if (port.public && port.public > 0) {
                portBindings[key] = [{ HostPort: `${port.public}` }];
            } else if (input.publishUnassignedPorts) {
                portBindings[key] = [{ HostPort: '' }];
            }
        }

        return {
 exposedPorts, portBindings 
};
    }

    async createContainer(input: CreateContainerRequest): Promise<Docker.ContainerInspectInfo> {
        const { exposedPorts, portBindings } = this.getPortsFromRequest(input);

        this.emitContainerCreateProgress(input, ProgressStageType.Accepted, 'accepted');
        this.emitContainerCreateProgress(input, ProgressStageType.Running, 'pulling-image');

        await ensureDockerImage(this.docker, this.eventBroker, input.image);

        this.emitContainerCreateProgress(input, ProgressStageType.Running, 'creating-container');

        const container = await this.docker.createContainer({
            Image: input.image,
            name: input.name,
            User: input.user,
            Env: (input.env ?? []).map((entry) => `${entry.key}=${entry.value}`),
            Cmd: input.cmd,
            Labels: {
                [VOLT_MANAGED_CONTAINER_LABEL_KEY]: VOLT_MANAGED_CONTAINER_LABEL_VALUE,
                [TEAM_CLUSTER_ID_LABEL_KEY]: this.tenantLabel,
                ...input.labels
            },
            ExposedPorts: exposedPorts,
            HostConfig: {
                Memory: input.memoryInMegabytes * 1024 * 1024,
                NanoCpus: Math.round(input.cpus * 1_000_000_000),
                Binds: input.binds,
                PortBindings: portBindings,
                NetworkMode: input.networkMode
            }
        });

        this.emitContainerCreateProgress(input, ProgressStageType.Running, 'starting-container', container.id);

        await container.start();
        const inspectedContainer = await container.inspect();

        this.emitContainerCreateProgress(input, ProgressStageType.Completed, 'container-ready', inspectedContainer.Id);

        return inspectedContainer;
    }

    readonly startContainer = async (containerId: string): Promise<void> => {
        await this.getContainer(containerId);
        await this.docker.getContainer(containerId).start();
    };

    readonly deleteContainer = async (containerId: string): Promise<void> => {
        await this.getContainer(containerId);
        await this.docker.getContainer(containerId).remove({
            force: true,
            v: true
        });
    };

    readonly writeContainerFile = async (
        containerId: string,
        filePath: string,
        content: string,
        options?: DockerExecOptions
    ): Promise<void> => {
        await this.getContainer(containerId);
        await writeContainerFile(this.docker, containerId, filePath, content, options);
    };

    async removeComposeProject(composeProjectName: string): Promise<void> {
        const projectFilter = {
            label: [`com.docker.compose.project=${composeProjectName}`]
        };
        const containers = await this.docker.listContainers({
            all: true,
            filters: JSON.stringify(projectFilter)
        });
        const volumes = await this.docker.listVolumes({
            filters: projectFilter
        });
        const networks = await this.docker.listNetworks({
            filters: JSON.stringify(projectFilter)
        });

        for (const containerInfo of containers) {
            await this.docker.getContainer(containerInfo.Id).remove({
                force: true,
                v: true
            });
        }

        for (const volumeInfo of volumes.Volumes) {
            await this.docker.getVolume(volumeInfo.Name).remove({ force: true });
        }

        for (const networkInfo of networks) {
            await this.docker.getNetwork(networkInfo.Id).remove();
        }
    }

    private emitContainerCreateProgress(
        input: CreateContainerRequest,
        stage: ProgressStageType,
        step: string,
        containerId?: string
    ): void {
        if (!input.operationId) {
            return;
        }

        this.eventBroker.emitProgress({
            action: OrchestrationAction.ContainerCreate,
            stage,
            timestamp: new Date().toISOString(),
            payload: {
                operationId: input.operationId,
                image: input.image,
                containerName: input.name,
                ...(containerId ? { containerId } : {}),
                step
            }
        });
    }
}

export const getDockerRuntime = singleton((): DockerRuntime => new DockerRuntime(getEventBroker(), getConfig()));
