import { createService, paginated, get, post, patch, del } from '@/app/core/http/utils/create-service';
import {
    createFolderCrudEndpoints,
    type FolderCreateParams,
    type FolderDeleteParams,
    type FolderGetParams,
    type FolderListParams,
    type FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { Container } from '@volt/contracts/modules/container/domain';

import type { ContainerFolder } from '@volt/contracts/modules/container/domain';
import type { ContainerPortAccessUrl } from '@volt/contracts/modules/container/domain';
import type { ContainerStatsResponse } from '@volt/contracts/modules/container/domain';
import type { EnvVariable } from '@volt/contracts/modules/container/domain';
import type { PortMapping } from '@volt/contracts/modules/container/domain';
import type { GetContainerFilesResponse, ReadContainerFileResponse } from '@volt/contracts/modules/container/domain';

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

export interface GetContainerFilesInput {
    containerId: string;
    path?: string;
}

export interface ReadContainerFileInput {
    containerId: string;
    path: string;
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
    getFiles: get<GetContainerFilesInput, GetContainerFilesResponse>('/:containerId/files', {
        query: ({ path }) => path ? { path } : undefined
    }),
    readFile: get<ReadContainerFileInput, ReadContainerFileResponse>('/:containerId/files/content', {
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
