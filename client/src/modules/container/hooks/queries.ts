import service from '../api/service';
import {
    buildKeys,
    createCachePolicy,
    createManagedMutation,
    createPaginatedQuery,
    createQuery
} from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
import type { CreateContainerParams } from '../api/dtos/create-container';
import type { CreateContainerFolderParams } from '../api/dtos/create-container-folder';
import type { DeleteContainerFolderParams } from '../api/dtos/delete-container-folder';
import type { GetContainerFilesInputDTO } from '../api/dtos/get-container-files';
import type { GetContainerFolderParams } from '../api/dtos/get-container-folder';
import type { GetContainersParams } from '../api/dtos/get-containers';
import type { ListContainerFoldersParams } from '../api/dtos/list-container-folders';
import type { MoveContainerParams } from '../api/dtos/move-container';
import type { ReadContainerFileInputDTO } from '../api/dtos/read-container-file';
import type { UpdateContainerFolderParams } from '../api/dtos/update-container-folder';
import type { UpdateContainerFields } from '../api/dtos/update-container';
import type { Container } from '../api/entities/container';
import type { ContainerFolder } from '../api/entities/container-folder';

const BASE_KEY = 'container';

interface ContainerQueryKeys extends Record<string, unknown> {
    detail: string;
    files: GetContainerFilesInputDTO;
    fileContent: ReadContainerFileInputDTO;
    folder: GetContainerFolderParams;
    folders: ListContainerFoldersParams;
    processes: string;
    stats: string;
};

const KEYS = buildKeys<ContainerQueryKeys>(BASE_KEY);

export const containerQuery = createPaginatedQuery<Container, GetContainersParams, CreateContainerParams, UpdateContainerFields>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    service: {
        list: service.getAll,
        create: service.create,
        update: (id, params) => service.update({ containerId: id, ...params }),
        delete: (id) => service.delete({ containerId: id })
    }
});

const containerFoldersCache = createCachePolicy<void>(() => KEYS.folders());
const containerFolderCache = createCachePolicy<GetContainerFolderParams>((params) => KEYS.folder(params));

export const containerFoldersQuery = createQuery(KEYS.folders, service.listFolders);
export const containerFolderQuery = createQuery(KEYS.folder, service.getFolder);

export const invalidateContainerFoldersQuery = () => containerFoldersCache.invalidate(undefined);
export const invalidateContainerFolderQuery = (params: GetContainerFolderParams) => containerFolderCache.invalidate(params);

export const useCreateContainerFolderMutation = createManagedMutation<ContainerFolder, CreateContainerFolderParams>(
    service.createFolder,
    () => invalidateContainerFoldersQuery()
);

export const useUpdateContainerFolderMutation = createManagedMutation<ContainerFolder, UpdateContainerFolderParams>(
    service.updateFolder,
    (_data, variables) => {
        invalidateContainerFoldersQuery();
        queryClient.invalidateQueries({ queryKey: containerQuery.QUERY_KEYS.lists() });
        invalidateContainerFolderQuery({ folderId: variables.folderId });
    }
);

export const useDeleteContainerFolderMutation = createManagedMutation<void, DeleteContainerFolderParams>(
    service.deleteFolder,
    (_data, variables) => {
        invalidateContainerFoldersQuery();
        queryClient.invalidateQueries({ queryKey: containerQuery.QUERY_KEYS.lists() });
        invalidateContainerFolderQuery({ folderId: variables.folderId });
    }
);

export const useMoveContainerMutation = createManagedMutation<void, MoveContainerParams>(
    service.move,
    () => queryClient.invalidateQueries({ queryKey: containerQuery.QUERY_KEYS.lists() })
);

export const useContainerFilesQuery = createQuery(KEYS.files, service.getFiles);
export const useContainerFileContentQuery = createQuery(KEYS.fileContent, service.readFile);

export const useContainerByIdQuery = createQuery(KEYS.detail, (containerId) => service.getById({ containerId }));
export const useContainerProcessesQuery = createQuery(KEYS.processes, (containerId) => service.getProcesses({ containerId }));
export const useContainerStatsQuery = createQuery(KEYS.stats, (containerId) => service.getStats({ containerId }));
