import { get, post, patch, del } from '../../shared/routing';
import type {
    CreateContainerInput,
    UpdateContainerInput,
    MoveContainerInput,
    CreateContainerFolderInput,
    UpdateContainerFolderInput
} from './http';
import type {
    CreateContainerResponse,
    GetContainerResponse,
    UpdateContainerResponse,
    ContainerPortAccessUrl,
    GetContainerFilesResponse,
    GetContainerProcessesResponse,
    ContainerStatsResponse,
    ReadContainerFileResponse,
    Container,
    ContainerFolder
} from './domain';

export const containerRoutes = {
    create: post<CreateContainerInput, CreateContainerResponse>('/api/teams/:teamId/containers'),
    list: get<Container>('/api/teams/:teamId/containers'),

    listFolders: get<ContainerFolder>('/api/teams/:teamId/container-folders'),
    getFolder: get<ContainerFolder>('/api/teams/:teamId/container-folders/:folderId'),
    createFolder: post<CreateContainerFolderInput, ContainerFolder>('/api/teams/:teamId/container-folders'),
    updateFolder: patch<UpdateContainerFolderInput, ContainerFolder>('/api/teams/:teamId/container-folders/:folderId'),
    removeFolder: del('/api/teams/:teamId/container-folders/:folderId'),

    get: get<GetContainerResponse>('/api/teams/:teamId/containers/:containerId'),
    update: patch<UpdateContainerInput, UpdateContainerResponse>('/api/teams/:teamId/containers/:containerId'),
    remove: del('/api/teams/:teamId/containers/:containerId'),

    createPortAccessUrl: post<never, ContainerPortAccessUrl>('/api/teams/:teamId/containers/:containerId/ports/:privatePort/access-url'),
    move: patch<MoveContainerInput, null>('/api/teams/:teamId/containers/:containerId/folder'),

    getFiles: get<GetContainerFilesResponse>('/api/teams/:teamId/containers/:containerId/files'),
    getProcesses: get<GetContainerProcessesResponse>('/api/teams/:teamId/containers/:containerId/processes'),
    getStats: get<ContainerStatsResponse>('/api/teams/:teamId/containers/:containerId/stats'),
    readFile: get<ReadContainerFileResponse>('/api/teams/:teamId/containers/:containerId/files/content')
} as const;
