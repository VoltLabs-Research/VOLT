import service from '../api/service';
import { teamClusterService } from '../api/service/team-cluster-service';
import {
    buildKeys,
    createInvalidatingMutation,
    createFolderResourceQueries,
    createPaginatedQuery,
    createQuery
} from '@/shared/infrastructure/query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { ClusterResourceLimits } from '../api/entities/cluster-resource-limits';
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
    resourceLimits: {
        teamId: string;
        teamClusterId: string;
    };
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

const containerFolderQueries = createFolderResourceQueries<
    ContainerFolder,
    PaginatedResponse<ContainerFolder>,
    ListContainerFoldersParams,
    GetContainerFolderParams,
    CreateContainerFolderParams,
    UpdateContainerFolderParams,
    DeleteContainerFolderParams
>({
    baseKey: `${BASE_KEY}-folder`,
    service: {
        listFolders: service.listFolders,
        getFolder: service.getFolder,
        createFolder: service.createFolder,
        updateFolder: service.updateFolder,
        deleteFolder: service.deleteFolder
    },
    buildFolderParams: (folderId) => ({ folderId }),
    listingQueryKeys: [containerQuery.QUERY_KEYS.lists()]
});

export const containerFoldersQueryKey = containerFolderQueries.foldersQueryKey;
export const containerFolderQueryKey = containerFolderQueries.folderQueryKey;
export const containerFoldersQuery = containerFolderQueries.foldersQuery;
export const containerFolderQuery = containerFolderQueries.folderQuery;
export const invalidateContainerFoldersQuery = containerFolderQueries.invalidateFoldersQuery;
export const invalidateContainerFolderQuery = containerFolderQueries.invalidateFolderQuery;
export const useCreateContainerFolderMutation = containerFolderQueries.useCreateFolderMutation;
export const useUpdateContainerFolderMutation = containerFolderQueries.useUpdateFolderMutation;
export const useDeleteContainerFolderMutation = containerFolderQueries.useDeleteFolderMutation;

export const useMoveContainerMutation = createInvalidatingMutation<void, MoveContainerParams>(
    service.move,
    [containerQuery.QUERY_KEYS.lists()]
);

export const useContainerFilesQuery = createQuery(KEYS.files, service.getFiles);
export const useContainerFileContentQuery = createQuery(KEYS.fileContent, service.readFile);

export const useContainerByIdQuery = createQuery(KEYS.detail, (containerId) => service.getById({ containerId }));
export const useContainerProcessesQuery = createQuery(KEYS.processes, (containerId) => service.getProcesses({ containerId }));
export const useClusterResourceLimitsQuery = createQuery<{ teamId: string; teamClusterId: string }, ClusterResourceLimits>(
    KEYS.resourceLimits,
    ({ teamId, teamClusterId }) => teamClusterService.getResourceLimits(teamId, teamClusterId)
);
export const useContainerStatsQuery = createQuery(KEYS.stats, (containerId) => service.getStats({ containerId }));
