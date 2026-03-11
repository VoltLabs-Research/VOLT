import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

export const createEmptyDocumentsResponse = <T extends { _id: string }>(
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

export const getDeleteConfirmationMessage = (selectedItems: LatexDocument[]): string => {
    if (selectedItems.length === 1) {
        return `Delete document "${selectedItems[0].title || 'Untitled Document'}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} documents? This action cannot be undone.`;
};
