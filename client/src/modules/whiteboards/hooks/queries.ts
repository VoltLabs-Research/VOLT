import service from '../api/service';
import {
    buildKeys,
    createCachePolicy,
    createManagedMutation,
    createMutation,
    createQuery
} from '@/shared/infrastructure/query';
import type { CreateWhiteboardParams } from '../api/dtos/create-whiteboard-params';
import type { DeleteWhiteboardParams } from '../api/dtos/delete-whiteboard-params';
import type { ListWhiteboardsParams } from '../api/dtos/list-whiteboards-params';
import type { UpdateWhiteboardParams } from '../api/dtos/update-whiteboard-params';
import type { Whiteboard } from '../api/entities/whiteboard';

interface WhiteboardQueryKeys extends Record<string, unknown> {
    list: ListWhiteboardsParams;
    single: { whiteboardId: string };
};

const KEYS = buildKeys<WhiteboardQueryKeys>('whiteboards');

export const whiteboardsQueryKey = KEYS.list;
export const whiteboardQueryKey = KEYS.single;

export const whiteboardsQuery = createQuery(
    KEYS.list,
    service.listWhiteboards
);

export const whiteboardQuery = createQuery(
    KEYS.single,
    service.getWhiteboard
);

const whiteboardsCache = createCachePolicy<void>(() => KEYS.list());

export const invalidateWhiteboardsQuery = () => whiteboardsCache.invalidate(undefined);

export const useCreateWhiteboardMutation = createMutation<Whiteboard, CreateWhiteboardParams>(
    service.createWhiteboard
);

export const useUpdateWhiteboardMutation = createManagedMutation<Whiteboard, UpdateWhiteboardParams>(
    service.updateWhiteboard,
    () => invalidateWhiteboardsQuery()
);

export const useDeleteWhiteboardMutation = createManagedMutation<void, DeleteWhiteboardParams>(
    service.deleteWhiteboard,
    () => invalidateWhiteboardsQuery()
);
