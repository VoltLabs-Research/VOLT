import { createService, paginated, get, post, patch, del, serviceRoutes } from '@/app/core/http/utils/create-service';
import { containerRoutes } from '@volt/contracts/modules/container/routes';
import {
    createFolderCrudEndpoints,
    type FolderCreateParams,
    type FolderDeleteParams,
    type FolderGetParams,
    type FolderListParams,
    type FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type { Container } from '@volt/contracts/modules/container/domain';

import type { ContainerFolder } from '@volt/contracts/modules/container/domain';
import type { ContainerPortAccessUrl } from '@volt/contracts/modules/container/domain';
import type { ContainerStatsResponse } from '@volt/contracts/modules/container/domain';
import type { EnvVariable } from '@volt/contracts/modules/container/domain';
import type { PortMapping } from '@volt/contracts/modules/container/domain';
import type { GetContainerFilesResponse, ReadContainerFileResponse } from '@volt/contracts/modules/container/domain';
import { normalizePortMapping } from '@/modules/container/utils/port-mapping';

export enum ContainerAction {
    Start = 'start',
    Stop = 'stop',
    Restart = 'restart'
}

interface ContainerRouteParams {
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

interface UpdateContainerParams extends UpdateContainerFields {
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

interface CreateContainerPortAccessUrlParams {
    teamId: string;
    containerId: string;
    privatePort: number;
}

const normalizePorts = (ports: CreateContainerParams['ports']) => ports?.map(normalizePortMapping);

const routes = serviceRoutes('/teams', { rbac: true });

const endpoints = {
    getAll: paginated<GetContainersParams, PaginatedResponse<Container>>('/containers'),
    getById: get<ContainerRouteParams, Container>('/containers/:containerId', {
        unwrap: { field: 'container' }
    }),
    create: post<CreateContainerParams, Container>('/containers', {
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
    update: patch<UpdateContainerParams, Container>('/containers/:containerId', {
        body: ({ action, env, ports }) => ({
            action,
            env,
            ports: normalizePorts(ports)
        }),
        unwrap: { field: 'container' }
    }),
    delete: del<ContainerRouteParams>('/containers/:containerId'),
    move: patch<MoveContainerParams, void>('/containers/:containerId/folder', {
        body: ({ folderId }) => ({ folderId })
    }),
    getFiles: get<GetContainerFilesInput, GetContainerFilesResponse>('/containers/:containerId/files', {
        query: ({ path }) => path ? { path } : undefined
    }),
    readFile: get<ReadContainerFileInput, ReadContainerFileResponse>('/containers/:containerId/files/content', {
        query: ({ path }) => ({ path })
    }),
    ...createFolderCrudEndpoints<
        FolderListParams,
        FolderGetParams,
        FolderCreateParams,
        FolderUpdateParams,
        FolderDeleteParams,
        ContainerFolder
    >({
        list: containerRoutes.listFolders,
        get: containerRoutes.getFolder,
        create: containerRoutes.createFolder,
        update: containerRoutes.updateFolder,
        remove: containerRoutes.removeFolder
    }, routes.path),
    createPortAccessUrl: post<CreateContainerPortAccessUrlParams, ContainerPortAccessUrl>('/containers/:containerId/ports/:privatePort/access-url', {
        client: 'scoped',
        omit: ['teamId'],
        body: () => ({})
    }),
    getProcesses: get<ContainerRouteParams, string[][]>('/containers/:containerId/processes', {
        unwrap: { field: 'processes' }
    }),
    getStats: get<ContainerRouteParams, ContainerStatsResponse>('/containers/:containerId/stats')
};

export default createService({
    clients: {
        default: {
            basePath: '/teams',
            useRBAC: true
        },
        scoped: {
            basePath: '/teams',
            useRBAC: true,
            getTeamId: (params: CreateContainerParams) => params.teamId
        }
    }
}, endpoints);
