import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

/**
 * Excalidraw `appState` keys that are safe to persist across sessions.
 * Transient fields (collaborators, loading flags, active selections, etc.)
 * are intentionally excluded to avoid restoring stale UI state.
 */
const PERSISTABLE_APP_STATE_KEYS = new Set([
    'viewBackgroundColor',
    'gridSize',
    'gridColor'
]);

type WhiteboardElement = Record<string, unknown>;

const getElementId = (element: WhiteboardElement): string | null => {
    const id = element.id;
    return typeof id === 'string' && id.length > 0 ? id : null;
};

const getElementVersion = (element: WhiteboardElement): number => {
    return typeof element.version === 'number' && Number.isFinite(element.version)
        ? element.version
        : 0;
};

const getElementUpdated = (element: WhiteboardElement): number => {
    return typeof element.updated === 'number' && Number.isFinite(element.updated)
        ? element.updated
        : 0;
};

const getElementVersionNonce = (element: WhiteboardElement): number => {
    return typeof element.versionNonce === 'number' && Number.isFinite(element.versionNonce)
        ? element.versionNonce
        : 0;
};

const hasEquivalentElementPayload = (current: WhiteboardElement, incoming: WhiteboardElement): boolean => {
    try {
        return JSON.stringify(current) === JSON.stringify(incoming);
    } catch {
        return false;
    }
};

const shouldReplaceElement = (current: WhiteboardElement | undefined, incoming: WhiteboardElement): boolean => {
    if (!current) {
        return true;
    }

    const versionDelta = getElementVersion(incoming) - getElementVersion(current);
    if (versionDelta !== 0) {
        return versionDelta > 0;
    }

    const updatedDelta = getElementUpdated(incoming) - getElementUpdated(current);
    if (updatedDelta !== 0) {
        return updatedDelta > 0;
    }

    const versionNonceDelta = getElementVersionNonce(incoming) - getElementVersionNonce(current);
    if (versionNonceDelta !== 0) {
        return versionNonceDelta > 0;
    }

    return !hasEquivalentElementPayload(current, incoming);
};

/**
 * Returns a copy of `appState` containing only fields that are safe to
 * persist to the server. Filters out transient, session-only fields such
 * as collaboration data, loading flags, and active-selection state.
 */
export const filterPersistableAppState = (
    appState: Record<string, unknown>
): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const key of PERSISTABLE_APP_STATE_KEYS) {
        if (key in appState) {
            result[key] = appState[key];
        }
    }
    return result;
};

export const mergeWhiteboardElements = (
    currentElements: WhiteboardElement[],
    incomingElements: WhiteboardElement[]
): WhiteboardElement[] => {
    const merged = new Map<string, WhiteboardElement>();
    const currentOrder: string[] = [];
    const incomingOrder: string[] = [];

    for (const element of currentElements) {
        const id = getElementId(element);
        if (!id) {
            continue;
        }

        merged.set(id, element);
        currentOrder.push(id);
    }

    for (const element of incomingElements) {
        const id = getElementId(element);
        if (!id) {
            continue;
        }

        incomingOrder.push(id);
        if (shouldReplaceElement(merged.get(id), element)) {
            merged.set(id, element);
        }
    }

    const orderedIds = new Set<string>();
    const result: WhiteboardElement[] = [];

    for (const id of incomingOrder) {
        const element = merged.get(id);
        if (!element || orderedIds.has(id)) {
            continue;
        }

        orderedIds.add(id);
        result.push(element);
    }

    for (const id of currentOrder) {
        const element = merged.get(id);
        if (!element || orderedIds.has(id)) {
            continue;
        }

        orderedIds.add(id);
        result.push(element);
    }

    return result;
};

export const mergeWhiteboardAppState = (
    currentAppState: Record<string, unknown>,
    incomingAppState: Record<string, unknown>
): Record<string, unknown> => ({
    ...currentAppState,
    ...filterPersistableAppState(incomingAppState)
});

export const extractWhiteboardFileIds = (elements: WhiteboardElement[]): string[] => {
    const fileIds = new Set<string>();

    for (const element of elements) {
        const fileId = element.fileId;
        if (typeof fileId === 'string' && fileId.length > 0) {
            fileIds.add(fileId);
        }
    }

    return Array.from(fileIds);
};

export const createEmptyWhiteboardsResponse = <T extends { _id: string }>(
    params: PaginationParams
): PaginatedResponse<T> => ({
    status: 'success',
    data: [],
    pagination: {
        page: Math.max(1, Number(params.page) || 1),
        limit: Math.max(1, Number(params.limit) || 20),
        total: 0,
        totalPages: 1,
        hasMore: false
    }
});

export const getDeleteConfirmationMessage = (selectedItems: Whiteboard[]): string => {
    if (selectedItems.length === 1) {
        return `Delete whiteboard "${selectedItems[0].title || 'Untitled Whiteboard'}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} whiteboards? This action cannot be undone.`;
};

export const getSafeWhiteboardTitle = (title: string | null | undefined): string => {
    const trimmedTitle = title?.trim();
    return trimmedTitle || 'Untitled Whiteboard';
};

export const getSafeFolderTitle = (title: string | null | undefined): string => {
    const trimmedTitle = title?.trim();
    return trimmedTitle || 'Untitled Folder';
};
