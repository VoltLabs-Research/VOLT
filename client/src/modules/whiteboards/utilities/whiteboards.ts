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
    'theme',
    'gridSize',
    'gridColor',
    'scrollX',
    'scrollY',
    'zoom',
    'currentStrokeColor',
    'currentBackgroundColor',
    'currentFillStyle',
    'currentLinearStrokeSharpness',
    'currentItemStrokeWidth',
    'currentItemOpacity',
    'currentItemFontFamily',
    'currentItemFontSize',
    'currentItemTextAlign',
    'currentItemStartArrowhead',
    'currentItemEndArrowhead',
    'exportBackground',
    'exportWithDarkMode',
    'exportEmbedScene',
    'exportScale'
]);

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
