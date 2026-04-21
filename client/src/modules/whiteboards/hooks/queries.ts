import service from '../api/service';
import {
    buildKeys,
    createFolderResourceQueries,
    createInvalidatingMutation,
    createPaginatedQuery,
    createQuery
} from '@/shared/infrastructure/query';
import type { PaginatedResponse } from '@/shared/domain/pagination';
import type { CreateWhiteboardFolderParams } from '../api/dtos/create-whiteboard-folder-params';
import type { CreateWhiteboardParams } from '../api/dtos/create-whiteboard-params';
import type { DeleteWhiteboardFolderParams } from '../api/dtos/delete-whiteboard-folder-params';
import type { DeleteWhiteboardParams } from '../api/dtos/delete-whiteboard-params';
import type { GetWhiteboardFolderParams } from '../api/dtos/get-whiteboard-folder-params';
import type { ListWhiteboardFoldersParams } from '../api/dtos/list-whiteboard-folders-params';
import type { ListWhiteboardsParams } from '../api/dtos/list-whiteboards-params';
import type { MoveWhiteboardParams } from '../api/dtos/move-whiteboard-params';
import type { UpdateWhiteboardFolderParams } from '../api/dtos/update-whiteboard-folder-params';
import type { UpdateWhiteboardParams } from '../api/dtos/update-whiteboard-params';
import type { WhiteboardFolder } from '../api/entities/whiteboard-folder';
import type { Whiteboard } from '../api/entities/whiteboard';

const BASE_KEY = 'whiteboards';

interface WhiteboardQueryKeys extends Record<string, unknown> {
    single: { whiteboardId: string };
    folders: ListWhiteboardFoldersParams;
    folder: GetWhiteboardFolderParams;
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
export const whiteboardQueryKey = KEYS.single;

export const whiteboardsQuery = whiteboardPaginatedQuery.useListQuery;
export const whiteboardQuery = createQuery(KEYS.single, service.getWhiteboard);

export const invalidateWhiteboardsQuery = () => whiteboardPaginatedQuery.cache.invalidate();

const whiteboardFolderQueries = createFolderResourceQueries<
    WhiteboardFolder,
    PaginatedResponse<WhiteboardFolder>,
    ListWhiteboardFoldersParams,
    GetWhiteboardFolderParams,
    CreateWhiteboardFolderParams,
    UpdateWhiteboardFolderParams,
    DeleteWhiteboardFolderParams
>({
    baseKey: 'whiteboards-folder',
    service: {
        listFolders: service.listWhiteboardFolders,
        getFolder: service.getWhiteboardFolder,
        createFolder: service.createWhiteboardFolder,
        updateFolder: service.updateWhiteboardFolder,
        deleteFolder: service.deleteWhiteboardFolder
    },
    buildFolderParams: (folderId) => ({ folderId }),
    listingQueryKeys: [whiteboardPaginatedQuery.QUERY_KEYS.lists()]
});

export const whiteboardFoldersQuery = whiteboardFolderQueries.foldersQuery;
export const whiteboardFolderQuery = whiteboardFolderQueries.folderQuery;
export const whiteboardFoldersQueryKey = whiteboardFolderQueries.foldersQueryKey;
export const whiteboardFolderQueryKey = whiteboardFolderQueries.folderQueryKey;
export const invalidateWhiteboardFoldersQuery = whiteboardFolderQueries.invalidateFoldersQuery;
export const invalidateWhiteboardFolderQuery = whiteboardFolderQueries.invalidateFolderQuery;
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
