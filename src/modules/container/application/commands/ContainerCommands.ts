import type { ContainerAction, CreateContainerRequest } from '@/contracts';
import { Command, CommandGroup } from '@/core/commands/decorators';
import { resolveComposeDefaultNetworkName } from '@/core/runtime/contracts/runtime-container';
import type { DockerRuntime } from '@/core/runtime/infrastructure/DockerRuntime';

interface ContainerListPayload {
    all?: boolean;
}

interface ContainerIdentifierPayload {
    containerId: string;
}

interface ContainerUpdatePayload extends ContainerIdentifierPayload {
    action: ContainerAction;
}

interface ContainerFilePayload extends ContainerIdentifierPayload {
    path: string;
}

@CommandGroup('container')
export class ContainerCommands {
    constructor(private readonly dockerRuntime: DockerRuntime) {}

    @Command('list')
    list(payload: ContainerListPayload | undefined) {
        return this.dockerRuntime.listContainers(payload?.all ?? true);
    }

    @Command('create', { status: 201 })
    create(payload: CreateContainerRequest) {
        const networkMode = payload.networkMode || resolveComposeDefaultNetworkName(process.env.COMPOSE_PROJECT_NAME);

        return this.dockerRuntime.createContainer(
            networkMode && !payload.networkMode
                ? { ...payload, networkMode }
                : payload
        );
    }

    @Command('get')
    get(payload: ContainerIdentifierPayload) {
        return this.dockerRuntime.getContainer(payload.containerId);
    }

    @Command('update')
    update(payload: ContainerUpdatePayload) {
        return this.dockerRuntime.applyContainerAction(payload.containerId, payload.action);
    }

    @Command('delete')
    async deleteContainer(payload: ContainerIdentifierPayload) {
        await this.dockerRuntime.deleteContainer(payload.containerId);
        return { deleted: true };
    }

    @Command('stats.get')
    getStats(payload: ContainerIdentifierPayload) {
        return this.dockerRuntime.getContainerStats(payload.containerId);
    }

    @Command('processes.list')
    listProcesses(payload: ContainerIdentifierPayload) {
        return this.dockerRuntime.getContainerProcesses(payload.containerId);
    }

    @Command('files.list')
    listFiles(payload: ContainerFilePayload) {
        return this.dockerRuntime.getContainerFiles(payload.containerId, payload.path || '/');
    }

    @Command('file.read')
    async readFile(payload: ContainerFilePayload) {
        return {
            contents: await this.dockerRuntime.readContainerFile(payload.containerId, payload.path || '')
        };
    }
}
