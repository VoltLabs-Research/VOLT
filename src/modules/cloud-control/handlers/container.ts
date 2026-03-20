import type { ContainerAction, CreateContainerRequest, ContainerEnvironmentVariable, ContainerPortMapping } from '@/shared/contracts';
import { TEAM_CLUSTER_DAEMON_COMMAND } from '@/shared/contracts';
import type { DockerRuntimeService } from '@/modules/platform/services';
import type { ReverseChannelCommandHandler } from '../services';
import {
    readContainerAction,
    readNumber,
    readOptionalBoolean,
    readOptionalPayloadRecord,
    readOptionalString,
    readOptionalStringArray,
    readOptionalStringRecord,
    readPayloadRecord,
    readString
} from './payloadValidation';

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

const readContainerEnvironmentVariables = (value: unknown): ContainerEnvironmentVariable[] | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    if (!Array.isArray(value)) {
        throw new Error('env must be an array');
    }

    const variables: ContainerEnvironmentVariable[] = [];
    for (const entry of value) {
        const record = readPayloadRecord(entry);
        variables.push({
            key: readString(record.key, 'env.key'),
            value: readString(record.value, 'env.value')
        });
    }

    return variables;
};

const readContainerPortMappings = (value: unknown): ContainerPortMapping[] | undefined => {
    if (typeof value === 'undefined') {
        return undefined;
    }

    if (!Array.isArray(value)) {
        throw new Error('ports must be an array');
    }

    const ports: ContainerPortMapping[] = [];
    for (const entry of value) {
        const record = readPayloadRecord(entry);
        const port: ContainerPortMapping = {
            private: readNumber(record.private, 'ports.private')
        };
        const publicPort = record.public;

        if (typeof publicPort !== 'undefined') {
            port.public = readNumber(publicPort, 'ports.public');
        }

        ports.push(port);
    }

    return ports;
};

const resolveComposeNetworkName = (): string | undefined => {
    const composeProjectName = process.env.COMPOSE_PROJECT_NAME?.trim();
    if (!composeProjectName) {
        return undefined;
    }

    return `${composeProjectName}_default`;
};

const readCreateContainerRequest = (payload: unknown): CreateContainerRequest => {
    const record = readPayloadRecord(payload);
    const request: CreateContainerRequest = {
        image: readString(record.image, 'image'),
        name: readString(record.name, 'name'),
        memoryInMegabytes: readNumber(record.memoryInMegabytes, 'memoryInMegabytes'),
        cpus: readNumber(record.cpus, 'cpus')
    };
    const env = readContainerEnvironmentVariables(record.env);
    const ports = readContainerPortMappings(record.ports);
    const binds = readOptionalStringArray(record.binds, 'binds');
    const labels = readOptionalStringRecord(record.labels, 'labels');
    const cmd = readOptionalStringArray(record.cmd, 'cmd');
    const operationId = readOptionalString(record.operationId).trim();
    const networkMode = readOptionalString(record.networkMode).trim();
    const user = readOptionalString(record.user).trim();

    if (env) {
        request.env = env;
    }

    if (ports) {
        request.ports = ports;
    }

    if (binds) {
        request.binds = binds;
    }

    if (labels) {
        request.labels = labels;
    }

    if (cmd) {
        request.cmd = cmd;
    }

    if (operationId) {
        request.operationId = operationId;
    }

    if (user) {
        request.user = user;
    }

    if (networkMode) {
        request.networkMode = networkMode;
    } else {
        const composeNetworkName = resolveComposeNetworkName();
        if (composeNetworkName) {
            request.networkMode = composeNetworkName;
        }
    }

    return request;
};

const readContainerIdentifierPayload = (payload: unknown): ContainerIdentifierPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        containerId: readString(record.containerId, 'containerId')
    };
};

const readContainerActionPayload = (payload: unknown): ContainerActionPayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        containerId: readString(record.containerId, 'containerId'),
        action: readContainerAction(record.action)
    };
};

const readContainerFilePayload = (payload: unknown, fallbackPath = '/'): ContainerFilePayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        containerId: readString(record.containerId, 'containerId'),
        path: readOptionalString(record.path, fallbackPath)
    };
};

const readContainerFileWritePayload = (payload: unknown): ContainerFileWritePayload => {
    const record = readOptionalPayloadRecord(payload);

    return {
        containerId: readString(record.containerId, 'containerId'),
        path: readString(record.path, 'path'),
        content: readString(record.content, 'content')
    };
};

export const createContainerHandlers = (deps: ContainerHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.list,
        execute: async (payload) => {
            const record = readOptionalPayloadRecord(payload);
            const all = readOptionalBoolean(record.all, true);
            return { data: await deps.dockerRuntimeService.listContainers(all) };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.create,
        execute: async (payload) => ({
            data: await deps.dockerRuntimeService.createContainer(readCreateContainerRequest(payload)),
            status: 201
        })
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.get,
        execute: async (payload) => {
            const request = readContainerIdentifierPayload(payload);
            return { data: await deps.dockerRuntimeService.getContainer(request.containerId) };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.update,
        execute: async (payload) => {
            const request = readContainerActionPayload(payload);
            return {
                data: await deps.dockerRuntimeService.applyContainerAction(request.containerId, request.action)
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.delete,
        execute: async (payload) => {
            const request = readContainerIdentifierPayload(payload);
            await deps.dockerRuntimeService.deleteContainer(request.containerId);
            return { data: { deleted: true } };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.stats.get,
        execute: async (payload) => {
            const request = readContainerIdentifierPayload(payload);
            return { data: await deps.dockerRuntimeService.getContainerStats(request.containerId) };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.processes.list,
        execute: async (payload) => {
            const request = readContainerIdentifierPayload(payload);
            return { data: await deps.dockerRuntimeService.getContainerProcesses(request.containerId) };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.files.list,
        execute: async (payload) => {
            const request = readContainerFilePayload(payload);
            return {
                data: await deps.dockerRuntimeService.getContainerFiles(request.containerId, request.path)
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.file.read,
        execute: async (payload) => {
            const request = readContainerFilePayload(payload, '');
            return {
                data: {
                    contents: await deps.dockerRuntimeService.readContainerFile(request.containerId, request.path)
                }
            };
        }
    },
    {
        command: TEAM_CLUSTER_DAEMON_COMMAND.container.file.write,
        execute: async (payload) => {
            const request = readContainerFileWritePayload(payload);
            await deps.dockerRuntimeService.writeContainerFile(request.containerId, request.path, request.content);
            return { data: { written: true } };
        }
    }
];
