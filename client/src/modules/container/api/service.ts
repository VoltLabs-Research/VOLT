import { createService, paginated, get, post, patch, del } from '@/app/core/http/utilities/create-service';
import {
    createFolderCrudEndpoints,
    type FolderCreateParams,
    type FolderDeleteParams,
    type FolderGetParams,
    type FolderListParams,
    type FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { Container } from './entities/container';
import type { ContainerFile } from './entities/container-file';
import type { ContainerFolder } from './entities/container-folder';
import type { ContainerPortAccessUrl } from './entities/container-port-access-url';
import type { ContainerStatsResponse } from './entities/container-stats';
import type { EnvVariable } from './entities/env-variable';
import type { PortMapping } from './entities/port-mapping';

export enum ContainerAction {
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart'
}

export interface ContainerRouteParams {
    containerId: string;
}

export interface CreateContainerParams {
    teamId: string;
    teamClusterId?: string;
    folderId?: string | null;
    operationId?: string;
    name: string;
    image: string;
    memory?: number;
    cpus?: number;
    env?: EnvVariable[];
    ports?: PortMapping[];
    cmd?: string[];
    mountDockerSocket?: boolean;
    useImageCmd?: boolean;
}

export interface UpdateContainerFields {
    action?: ContainerAction;
    env?: EnvVariable[];
    ports?: PortMapping[];
}

export interface UpdateContainerParams extends UpdateContainerFields {
    containerId: string;
}

export interface GetContainersParams {
    page: number;
    limit: number;
    folderId?: string;
    search?: string;
}

export interface MoveContainerParams {
    containerId: string;
    folderId: string | null;
}

export interface GetContainerFilesInputDTO {
    containerId: string;
    path?: string;
}

export interface GetContainerFilesOutputDTO {
    files: ContainerFile[];
}

export interface ReadContainerFileInputDTO {
    containerId: string;
    path: string;
}

export interface ReadContainerFileOutputDTO {
    content: string;
}

export interface CreateContainerPortAccessUrlParams {
    teamId: string;
    containerId: string;
    privatePort: number;
}

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
    move: patch<MoveContainerParams, void>('/:containerId/folder', {
        body: ({ folderId }) => ({ folderId })
    }),
    getFiles: get<GetContainerFilesInputDTO, GetContainerFilesOutputDTO>('/:containerId/files', {
        query: ({ path }) => path ? { path } : undefined
    }),
    readFile: get<ReadContainerFileInputDTO, ReadContainerFileOutputDTO>('/:containerId/files/content', {
        query: ({ path }) => ({ path })
    }),
    ...createFolderCrudEndpoints<
        FolderListParams,
        FolderGetParams,
        FolderCreateParams,
        FolderUpdateParams,
        FolderDeleteParams,
        ContainerFolder
    >(),
    createPortAccessUrl: post<CreateContainerPortAccessUrlParams, ContainerPortAccessUrl>('/:containerId/ports/:privatePort/access-url', {
        client: 'scoped',
        omit: ['teamId'],
        body: () => ({})
    }),
    getProcesses: get<ContainerRouteParams, string[][]>('/:containerId/processes', {
        unwrap: { field: 'processes' }
    }),
    getStats: get<ContainerRouteParams, ContainerStatsResponse>('/:containerId/stats')
};

export default createService({
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
    }
}, endpoints);
