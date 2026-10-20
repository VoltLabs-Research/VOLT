import service from '../api/service';
import { buildKeys } from '@/shared/query/query-keys';
import { createFolderResourceQueries } from '@/shared/query/create-folder-resource-queries';
import { createInvalidatingMutation } from '@/shared/query/create-mutation';
import { createPaginatedQuery } from '@/shared/query/create-paginated-query';
import { createQuery } from '@/shared/query/create-query';
import type {
    FolderCreateParams,
    FolderDeleteParams,
    FolderGetParams,
    FolderListParams,
    FolderUpdateParams
} from '@/shared/api/folder-endpoints';
import type { PaginatedResponse } from '@voltstack/voltclient';
import type {
    CreateWhiteboardParams,
    DeleteWhiteboardParams,
    ListWhiteboardsParams,
    MoveWhiteboardParams,
    UpdateWhiteboardParams
} from '../api/service';
import type { WhiteboardFolder } from '@volt/contracts/modules/whiteboards/domain';
import type { Whiteboard } from '@volt/contracts/modules/whiteboards/domain';

const BASE_KEY = 'whiteboards';

interface WhiteboardQueryKeys {
    single: { whiteboardId: string };
};

const KEYS = buildKeys<WhiteboardQueryKeys>(BASE_KEY);

const whiteboardPaginatedQuery = createPaginatedQuery<Whiteboard, ListWhiteboardsParams>({
    baseKey: BASE_KEY,
    detailKey: (whiteboardId) => KEYS.single({ whiteboardId }),
    service: {
        list: service.listWhiteboards
    }
});

export const whiteboardsQueryKey = whiteboardPaginatedQuery.QUERY_KEYS.lists;

export const whiteboardsQuery = whiteboardPaginatedQuery.useListQuery;
export const whiteboardQuery = createQuery(KEYS.single, service.getWhiteboard);

const whiteboardFolderQueries = createFolderResourceQueries<
    WhiteboardFolder,
    PaginatedResponse<WhiteboardFolder>,
    FolderListParams,
    FolderGetParams,
    FolderCreateParams,
    FolderUpdateParams,
    FolderDeleteParams
>({
    baseKey: 'whiteboards-folder',
    service: {
        listFolders: service.listWhiteboardFolders,
        getFolder: service.getWhiteboardFolder,
        createFolder: service.createWhiteboardFolder,
        updateFolder: service.updateWhiteboardFolder,
        deleteFolder: service.deleteWhiteboardFolder
    },
    listingQueryKeys: [whiteboardPaginatedQuery.QUERY_KEYS.lists()]
});

export const whiteboardFoldersQuery = whiteboardFolderQueries.foldersQuery;
export const whiteboardFolderQuery = whiteboardFolderQueries.folderQuery;
export const useCreateWhiteboardFolderMutation = whiteboardFolderQueries.useCreateFolderMutation;
export const useUpdateWhiteboardFolderMutation = whiteboardFolderQueries.useUpdateFolderMutation;
export const useDeleteWhiteboardFolderMutation = whiteboardFolderQueries.useDeleteFolderMutation;

export const useCreateWhiteboardMutation = createInvalidatingMutation<Whiteboard, CreateWhiteboardParams>(
    service.createWhiteboard,
    [whiteboardPaginatedQuery.QUERY_KEYS.lists()]
);

export const useUpdateWhiteboardMutation = createInvalidatingMutation<Whiteboard, UpdateWhiteboardParams>(
    service.updateWhiteboard,
    (_data, variables) => [
        whiteboardPaginatedQuery.QUERY_KEYS.lists(),
        KEYS.single({ whiteboardId: variables.whiteboardId })
    ]
);

export const useDeleteWhiteboardMutation = createInvalidatingMutation<void, DeleteWhiteboardParams>(
    service.deleteWhiteboard,
    [whiteboardPaginatedQuery.QUERY_KEYS.lists()]
);

export const useMoveWhiteboardMutation = createInvalidatingMutation<Whiteboard, MoveWhiteboardParams>(
    service.moveWhiteboard,
    (_data, variables) => [
        whiteboardPaginatedQuery.QUERY_KEYS.lists(),
        KEYS.single({ whiteboardId: variables.whiteboardId })
    ]
);
