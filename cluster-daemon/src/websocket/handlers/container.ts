import type { DockerRuntimeService } from '../../infrastructure/docker/DockerRuntimeService';
import type { ReverseChannelCommandHandler } from '../ReverseChannelSocketBridge';
import { readString } from './payloadValidation';

interface ContainerHandlersDependencies {
    dockerRuntimeService: DockerRuntimeService;
}

export const createContainerHandlers = (deps: ContainerHandlersDependencies): ReverseChannelCommandHandler[] => [
    {
        command: 'container.list',
        execute: async (payload) => {
            const all = typeof payload?.all === 'boolean' ? payload.all : true;
            return { data: await deps.dockerRuntimeService.listContainers(all) };
        }
    },
    {
        command: 'container.create',
        execute: async (payload) => ({
            data: await deps.dockerRuntimeService.createContainer(payload as never),
            status: 201
        })
    },
    {
        command: 'container.get',
        execute: async (payload) => ({
            data: await deps.dockerRuntimeService.getContainer(readString(payload?.containerId, 'containerId'))
        })
    },
    {
        command: 'container.update',
        execute: async (payload) => ({
            data: await deps.dockerRuntimeService.applyContainerAction(
                readString(payload?.containerId, 'containerId'),
                payload?.action as never
            )
        })
    },
    {
        command: 'container.delete',
        execute: async (payload) => {
            await deps.dockerRuntimeService.deleteContainer(readString(payload?.containerId, 'containerId'));
            return { data: { deleted: true } };
        }
    },
    {
        command: 'container.stats.get',
        execute: async (payload) => ({
            data: await deps.dockerRuntimeService.getContainerStats(readString(payload?.containerId, 'containerId'))
        })
    },
    {
        command: 'container.processes.list',
        execute: async (payload) => ({
            data: await deps.dockerRuntimeService.getContainerProcesses(readString(payload?.containerId, 'containerId'))
        })
    },
    {
        command: 'container.files.list',
        execute: async (payload) => ({
            data: await deps.dockerRuntimeService.getContainerFiles(
                readString(payload?.containerId, 'containerId'),
                typeof payload?.path === 'string' ? payload.path : '/'
            )
        })
    },
    {
        command: 'container.file.read',
        execute: async (payload) => ({
            data: {
                contents: await deps.dockerRuntimeService.readContainerFile(
                    readString(payload?.containerId, 'containerId'),
                    readString(payload?.path, 'path')
                )
            }
        })
    },
    {
        command: 'container.file.write',
        execute: async (payload) => {
            await deps.dockerRuntimeService.writeContainerFile(
                readString(payload?.containerId, 'containerId'),
                readString(payload?.path, 'path'),
                readString(payload?.content, 'content')
            );
            return { data: { written: true } };
        }
    }
];
