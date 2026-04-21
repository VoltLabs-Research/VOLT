import { paginated, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import { createFolderCrudEndpoints } from '@/shared/api/folder-endpoints';
import { defineServiceModule } from '@/shared/api/service-module';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ContainerRouteParams } from './dtos/container-route-params';
import type { CreateContainerFolderParams } from './dtos/create-container-folder';
import type { CreateContainerParams } from './dtos/create-container';
import type { CreateContainerPortProxySessionParams } from './dtos/create-container-port-proxy-session';
import type { DeleteContainerFolderParams } from './dtos/delete-container-folder';
import type { GetContainerFilesInputDTO, GetContainerFilesOutputDTO } from './dtos/get-container-files';
import type { GetContainerFolderParams } from './dtos/get-container-folder';
import type { GetContainersParams } from './dtos/get-containers';
import type { ListContainerFoldersParams } from './dtos/list-container-folders';
import type { ReadContainerFileInputDTO, ReadContainerFileOutputDTO } from './dtos/read-container-file';
import type { UpdateContainerFolderParams } from './dtos/update-container-folder';
import type { UpdateContainerParams } from './dtos/update-container';
import type { Container } from './entities/container';
import type { ContainerFolder } from './entities/container-folder';
import type { ContainerPortProxySession } from './entities/container-port-proxy-session';
import type { ContainerStatsResponse } from './entities/container-stats';

const normalizePorts = (ports: CreateContainerParams['ports']) => ports?.map(({ public: publicPort, ...port }) => (
    publicPort === 0
        ? port
        : {
            ...port,
            public: publicPort
        }
));

const endpoints = {
    getAll: paginated<GetContainersParams, PaginatedResponse<Container>>('/'),
    getById: get<ContainerRouteParams, Container>('/:containerId', {
        unwrap: { field: 'container' }
    }),
    create: post<CreateContainerParams, Container>('/', {
        client: 'scoped',
        omit: ['teamId'],
        body: ({ teamClusterId, folderId, operationId, name, image, memory, cpus, env, ports, cmd, mountDockerSocket, useImageCmd }) => ({
            teamClusterId,
            folderId,
            operationId,
            name,
            image,
            memory,
            cpus,
            env,
            ports: normalizePorts(ports),
            cmd,
            mountDockerSocket,
            useImageCmd
        }),
        unwrap: { field: 'container' }
    }),
    update: patch<UpdateContainerParams, Container>('/:containerId', {
        body: ({ action, env, ports }) => ({
            action,
            env,
            ports: normalizePorts(ports)
        }),
        unwrap: { field: 'container' }
    }),
    delete: del<ContainerRouteParams>('/:containerId'),
    move: patch<{ containerId: string; folderId: string | null }, void>('/:containerId/folder', {
        body: ({ folderId }) => ({ folderId })
    }),
    getFiles: get<GetContainerFilesInputDTO, GetContainerFilesOutputDTO>('/:containerId/files', {
        query: ({ path }) => {
            let query: { path: string } | undefined;
            if (path) {
                query = { path };
            }
            return query;
        }
    }),
    readFile: get<ReadContainerFileInputDTO, ReadContainerFileOutputDTO>('/:containerId/files/content', {
        query: ({ path }) => ({ path })
    }),
    ...createFolderCrudEndpoints<
        ListContainerFoldersParams,
        GetContainerFolderParams,
        CreateContainerFolderParams,
        UpdateContainerFolderParams,
        DeleteContainerFolderParams,
        ContainerFolder
    >(),
    createPortProxySession: post<CreateContainerPortProxySessionParams, ContainerPortProxySession>('/:containerId/ports/:privatePort/session', {
        client: 'scoped',
        omit: ['teamId'],
        body: () => ({})
    }),
    getProcesses: get<ContainerRouteParams, string[][]>('/:containerId/processes', {
        unwrap: { field: 'processes' }
    }),
    getStats: get<ContainerRouteParams, ContainerStatsResponse>('/:containerId/stats')
};

export default defineServiceModule({
    clients: {
        default: {
            basePath: '/containers',
            useRBAC: true
        },
        scoped: {
            basePath: '/containers',
            useRBAC: true,
            getTeamId: (params: CreateContainerParams) => params.teamId
        }
    },
    endpoints
});
