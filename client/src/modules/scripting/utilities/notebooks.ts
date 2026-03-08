import type { ScriptingNotebook } from '@/modules/scripting/api/entities/scripting-notebook';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

export const createEmptyNotebooksResponse = (
    params: PaginationParams
): PaginatedResponse<ScriptingNotebook> => ({
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

export const getTrajectoryIds = (notebook: ScriptingNotebook): string[] => {
    if (!Array.isArray(notebook.trajectories)) {
        return [];
    }

    return notebook.trajectories.map(String).filter((id) => id.trim().length > 0);
};

export const getDeleteConfirmationMessage = (selectedItems: ScriptingNotebook[]): string => {
    if (selectedItems.length === 1) {
        return `Delete notebook "${selectedItems[0].title || 'Untitled Notebook'}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} notebooks? This action cannot be undone.`;
};
