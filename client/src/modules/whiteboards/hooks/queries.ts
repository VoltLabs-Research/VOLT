import service from '../api/service';
import {
    buildKeys,
    createInvalidatingMutation,
    createFolderResourceQueries,
    createQuery
} from '@/shared/infrastructure/query';
import queryClient from '@/shared/infrastructure/query/query-client';
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

interface WhiteboardQueryKeys extends Record<string, unknown> {
    list: ListWhiteboardsParams;
    single: { whiteboardId: string };
    folders: ListWhiteboardFoldersParams;
    folder: GetWhiteboardFolderParams;
};

const KEYS = buildKeys<WhiteboardQueryKeys>('whiteboards');

export const whiteboardsQueryKey = KEYS.list;
export const whiteboardQueryKey = KEYS.single;

export const whiteboardsQuery = createQuery(KEYS.list, service.listWhiteboards);
export const whiteboardQuery = createQuery(KEYS.single, service.getWhiteboard);

export const invalidateWhiteboardsQuery = () => queryClient.invalidateQueries({ queryKey: KEYS.list() });

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
    listingQueryKeys: [KEYS.list()]
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
    [KEYS.list()]
);

export const useUpdateWhiteboardMutation = createInvalidatingMutation<Whiteboard, UpdateWhiteboardParams>(
    service.updateWhiteboard,
    (_data, variables) => [
        KEYS.list(),
        KEYS.single({ whiteboardId: variables.whiteboardId })
    ]
);

export const useDeleteWhiteboardMutation = createInvalidatingMutation<void, DeleteWhiteboardParams>(
    service.deleteWhiteboard,
    [KEYS.list()]
);

export const useMoveWhiteboardMutation = createInvalidatingMutation<Whiteboard, MoveWhiteboardParams>(
    service.moveWhiteboard,
    (_data, variables) => [
        KEYS.list(),
        KEYS.single({ whiteboardId: variables.whiteboardId })
    ]
);
