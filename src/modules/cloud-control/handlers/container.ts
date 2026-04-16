import type { ContainerAction, CreateContainerRequest } from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import type { DockerRuntimeService } from '@/modules/platform/services';
import type { ReverseChannelCommandHandler } from '../services';

interface ContainerHandlersDependencies {
    dockerRuntimeService: DockerRuntimeService;
};

interface ContainerIdentifierPayload {
    containerId: string;
};

interface ContainerActionPayload extends ContainerIdentifierPayload {
    action: ContainerAction;
};

interface ContainerFilePayload extends ContainerIdentifierPayload {
    path: string;
};

interface ContainerFileWritePayload extends ContainerFilePayload {
    content: string;
};

const resolveComposeNetworkName = (): string | undefined => {
    const composeProjectName = process.env.COMPOSE_PROJECT_NAME?.trim();
    if (!composeProjectName) {
        return undefined;
    }

    return `${composeProjectName}_default`;
};

export const createContainerHandlers = (deps: ContainerHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.list,
        execute: async (payload) => {
            const all = (payload as { all?: boolean } | undefined)?.all ?? true;
            return { data: await deps.dockerRuntimeService.listContainers(all) };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.create,
        execute: async (payload) => {
            const request = payload as CreateContainerRequest;
            const networkMode = request.networkMode || resolveComposeNetworkName();

            return {
                data: await deps.dockerRuntimeService.createContainer(
                    networkMode && !request.networkMode
                        ? { ...request, networkMode }
                        : request
                ),
                status: 201
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.get,
        execute: async (payload) => {
            const request = payload as ContainerIdentifierPayload;
            return { data: await deps.dockerRuntimeService.getContainer(request.containerId) };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.update,
        execute: async (payload) => {
            const request = payload as ContainerActionPayload;
            return {
                data: await deps.dockerRuntimeService.applyContainerAction(request.containerId, request.action)
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.delete,
        execute: async (payload) => {
            const request = payload as ContainerIdentifierPayload;
            await deps.dockerRuntimeService.deleteContainer(request.containerId);
            return { data: { deleted: true } };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.stats.get,
        execute: async (payload) => {
            const request = payload as ContainerIdentifierPayload;
            return { data: await deps.dockerRuntimeService.getContainerStats(request.containerId) };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.processes.list,
        execute: async (payload) => {
            const request = payload as ContainerIdentifierPayload;
            return { data: await deps.dockerRuntimeService.getContainerProcesses(request.containerId) };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.files.list,
        execute: async (payload) => {
            const request = payload as ContainerFilePayload;
            return {
                data: await deps.dockerRuntimeService.getContainerFiles(request.containerId, request.path || '/')
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.file.read,
        execute: async (payload) => {
            const request = payload as ContainerFilePayload;
            return {
                data: {
                    contents: await deps.dockerRuntimeService.readContainerFile(request.containerId, request.path || '')
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.file.write,
        execute: async (payload) => {
            const request = payload as ContainerFileWritePayload;
            await deps.dockerRuntimeService.writeContainerFile(request.containerId, request.path, request.content);
            return { data: { written: true } };
        }
    }
];
