import service from '../api/service';
import {
    buildKeys,
    createCachePolicy,
    createManagedMutation,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
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
export const whiteboardFoldersQueryKey = KEYS.folders;
export const whiteboardFolderQueryKey = KEYS.folder;

export const whiteboardsQuery = createQuery(KEYS.list, service.listWhiteboards);
export const whiteboardQuery = createQuery(KEYS.single, service.getWhiteboard);
export const whiteboardFoldersQuery = createQuery(KEYS.folders, service.listWhiteboardFolders);
export const whiteboardFolderQuery = createQuery(KEYS.folder, service.getWhiteboardFolder);

const whiteboardsCache = createCachePolicy<void>(() => KEYS.list());
const whiteboardFoldersCache = createCachePolicy<void>(() => KEYS.folders());
const whiteboardFolderCache = createCachePolicy<GetWhiteboardFolderParams>((params) => KEYS.folder(params));

export const invalidateWhiteboardsQuery = () => whiteboardsCache.invalidate(undefined);
export const invalidateWhiteboardFoldersQuery = () => whiteboardFoldersCache.invalidate(undefined);
export const invalidateWhiteboardFolderQuery = (params: GetWhiteboardFolderParams) => whiteboardFolderCache.invalidate(params);

export const useCreateWhiteboardMutation = createMutation<Whiteboard, CreateWhiteboardParams>(service.createWhiteboard);

export const useUpdateWhiteboardMutation = createManagedMutation<Whiteboard, UpdateWhiteboardParams>(
    service.updateWhiteboard,
    () => invalidateWhiteboardsQuery()
);

export const useDeleteWhiteboardMutation = createManagedMutation<void, DeleteWhiteboardParams>(
    service.deleteWhiteboard,
    () => invalidateWhiteboardsQuery()
);

export const useCreateWhiteboardFolderMutation = createManagedMutation<WhiteboardFolder, CreateWhiteboardFolderParams>(
    service.createWhiteboardFolder,
    () => invalidateWhiteboardFoldersQuery()
);

export const useUpdateWhiteboardFolderMutation = createManagedMutation<WhiteboardFolder, UpdateWhiteboardFolderParams>(
    service.updateWhiteboardFolder,
    (_data, variables) => {
        invalidateWhiteboardFoldersQuery();
        invalidateWhiteboardsQuery();
        invalidateWhiteboardFolderQuery({ folderId: variables.folderId });
    }
);

export const useDeleteWhiteboardFolderMutation = createManagedMutation<void, DeleteWhiteboardFolderParams>(
    service.deleteWhiteboardFolder,
    (_data, variables) => {
        invalidateWhiteboardFoldersQuery();
        invalidateWhiteboardsQuery();
        invalidateWhiteboardFolderQuery({ folderId: variables.folderId });
    }
);

export const useMoveWhiteboardMutation = createManagedMutation<Whiteboard, MoveWhiteboardParams>(
    service.moveWhiteboard,
    () => invalidateWhiteboardsQuery()
);
