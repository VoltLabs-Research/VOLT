import service, {
    type CreateContainerParams,
    type GetContainerFilesInput,
    type GetContainersParams,
    type MoveContainerParams,
    type ReadContainerFileInput,
    type UpdateContainerFields
} from '../api/service';
import { teamClusterService } from '@/modules/cluster/api/service';
import {
    buildKeys,
    createInvalidatingMutation,
    createFolderResourceQueries,
    createPaginatedQuery,
    createQuery
} from '@/shared/query';
import type {
    FolderCreateParams,
    FolderDeleteParams,
    FolderGetParams,
    FolderListParams,
    FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import type { PaginatedResponse } from '@/shared/pagination/PaginationResponse';
import type { ClusterResourceLimits } from '@volt/contracts/modules/cluster/domain';
import type { Container } from '@volt/contracts/modules/container/domain';
import type { ContainerFolder } from '@volt/contracts/modules/container/domain';

const BASE_KEY = 'container';

interface ContainerQueryKeys {
    detail: string;
    files: GetContainerFilesInput;
    fileContent: ReadContainerFileInput;
    folder: FolderGetParams;
    folders: FolderListParams;
    processes: string;
    resourceLimits: {
        teamId: string;
        teamClusterId: string;
    };
    stats: string;
}

const KEYS = buildKeys<ContainerQueryKeys>(BASE_KEY);

export const containerQuery = createPaginatedQuery<Container, GetContainersParams, CreateContainerParams, UpdateContainerFields>({
    baseKey: BASE_KEY,
    detailKey: KEYS.detail,
    service: {
        list: service.getAll,
        create: service.create,
        update: (id, params) => service.update({
            containerId: id,
            ...params
        }),
        delete: (id) => service.delete({ containerId: id })
    }
});

const containerFolderQueries = createFolderResourceQueries<
    ContainerFolder,
    PaginatedResponse<ContainerFolder>,
    FolderListParams,
    FolderGetParams,
    FolderCreateParams,
    FolderUpdateParams,
    FolderDeleteParams
>({
    baseKey: `${BASE_KEY}-folder`,
    service: {
        listFolders: service.listFolders,
        getFolder: service.getFolder,
        createFolder: service.createFolder,
        updateFolder: service.updateFolder,
        deleteFolder: service.deleteFolder
    },
    listingQueryKeys: [containerQuery.QUERY_KEYS.lists()]
});

export const containerFoldersQuery = containerFolderQueries.foldersQuery;
export const containerFolderQuery = containerFolderQueries.folderQuery;
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
    async ({ teamId, teamClusterId }) => {
        const result = await teamClusterService.getResourceLimits({
            teamId,
            teamClusterId
        });
        return result.resourceLimits;
    }
);
export const useContainerStatsQuery = createQuery(KEYS.stats, (containerId) => service.getStats({ containerId }));
