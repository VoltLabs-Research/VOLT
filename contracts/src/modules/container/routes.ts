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
    CreateContainerPortAccessUrlResponse,
    GetContainerFilesResponse,
    GetContainerProcessesResponse,
    GetContainerStatsResponse,
    ReadContainerFileResponse,
    Container,
    ContainerFolder
} from './domain';

export const containerRoutes = {
    create: post<CreateContainerInput, CreateContainerResponse>('/api/containers/:teamId'),
    list: get<Container>('/api/containers/:teamId'),

    listFolders: get<ContainerFolder>('/api/containers/:teamId/folders'),
    getFolder: get<ContainerFolder>('/api/containers/:teamId/folders/:folderId'),
    createFolder: post<CreateContainerFolderInput, ContainerFolder>('/api/containers/:teamId/folders'),
    updateFolder: patch<UpdateContainerFolderInput, ContainerFolder>('/api/containers/:teamId/folders/:folderId'),
    removeFolder: del('/api/containers/:teamId/folders/:folderId'),

    get: get<GetContainerResponse>('/api/containers/:teamId/:containerId'),
    update: patch<UpdateContainerInput, UpdateContainerResponse>('/api/containers/:teamId/:containerId'),
    remove: del('/api/containers/:teamId/:containerId'),

    createPortAccessUrl: post<never, CreateContainerPortAccessUrlResponse>('/api/containers/:teamId/:containerId/ports/:privatePort/access-url'),
    move: patch<MoveContainerInput, null>('/api/containers/:teamId/:containerId/folder'),

    getFiles: get<GetContainerFilesResponse>('/api/containers/:teamId/:containerId/files'),
    getProcesses: get<GetContainerProcessesResponse>('/api/containers/:teamId/:containerId/processes'),
    getStats: get<GetContainerStatsResponse>('/api/containers/:teamId/:containerId/stats'),
    readFile: get<ReadContainerFileResponse>('/api/containers/:teamId/:containerId/files/content')
} as const;
