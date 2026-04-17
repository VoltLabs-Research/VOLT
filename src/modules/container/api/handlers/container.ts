import type { ContainerAction, CreateContainerRequest } from '@/contracts';
import { ChannelCommands } from '@/contracts';
import type { ReverseChannelCommandHandler } from '@/core/reverse-channel/contracts/commandHandler';
import type { DockerRuntimeService } from '@/core/runtime/infrastructure/DockerRuntimeService';

interface ContainerHandlersDependencies {
    dockerRuntimeService: DockerRuntimeService;
}

interface ContainerIdentifierPayload {
    containerId: string;
}

interface ContainerActionPayload extends ContainerIdentifierPayload {
    action: ContainerAction;
}

interface ContainerFilePayload extends ContainerIdentifierPayload {
    path: string;
}

interface ContainerFileWritePayload extends ContainerFilePayload {
    content: string;
}

const resolveComposeNetworkName = (): string | undefined => {
    const composeProjectName = process.env.COMPOSE_PROJECT_NAME?.trim();
    if (!composeProjectName) {
        return undefined;
    }

    return `${composeProjectName}_default`;
};

export const createContainerHandlers = (deps: ContainerHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: ChannelCommands.ContainerList,
        execute: async (payload) => {
            const all = (payload as { all?: boolean } | undefined)?.all ?? true;
            return { data: await deps.dockerRuntimeService.listContainers(all) };
        }
    },
    {
        command: ChannelCommands.ContainerCreate,
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
        command: ChannelCommands.ContainerGet,
        execute: async (payload) => {
            const request = payload as ContainerIdentifierPayload;
            return { data: await deps.dockerRuntimeService.getContainer(request.containerId) };
        }
    },
    {
        command: ChannelCommands.ContainerUpdate,
        execute: async (payload) => {
            const request = payload as ContainerActionPayload;
            return {
                data: await deps.dockerRuntimeService.applyContainerAction(request.containerId, request.action)
            };
        }
    },
    {
        command: ChannelCommands.ContainerDelete,
        execute: async (payload) => {
            const request = payload as ContainerIdentifierPayload;
            await deps.dockerRuntimeService.deleteContainer(request.containerId);
            return { data: { deleted: true } };
        }
    },
    {
        command: ChannelCommands.ContainerStats,
        execute: async (payload) => {
            const request = payload as ContainerIdentifierPayload;
            return { data: await deps.dockerRuntimeService.getContainerStats(request.containerId) };
        }
    },
    {
        command: ChannelCommands.ContainerProcessesList,
        execute: async (payload) => {
            const request = payload as ContainerIdentifierPayload;
            return { data: await deps.dockerRuntimeService.getContainerProcesses(request.containerId) };
        }
    },
    {
        command: ChannelCommands.ContainerFilesList,
        execute: async (payload) => {
            const request = payload as ContainerFilePayload;
            return {
                data: await deps.dockerRuntimeService.getContainerFiles(request.containerId, request.path || '/')
            };
        }
    },
    {
        command: ChannelCommands.ContainerFileRead,
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
        command: ChannelCommands.ContainerFileWrite,
        execute: async (payload) => {
            const request = payload as ContainerFileWritePayload;
            await deps.dockerRuntimeService.writeContainerFile(request.containerId, request.path, request.content);
            return { data: { written: true } };
        }
    }
];
