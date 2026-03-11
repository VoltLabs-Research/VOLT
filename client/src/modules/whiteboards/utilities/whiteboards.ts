import type { Whiteboard } from '@/modules/whiteboards/api/entities/whiteboard';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

export const createEmptyWhiteboardsResponse = (
    params: PaginationParams
): PaginatedResponse<Whiteboard> => ({
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
