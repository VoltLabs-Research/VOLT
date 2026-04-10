import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import type { LammpsScript } from '@/modules/lammps/api/types';

export const createEmptyLammpsResponse = <T extends { _id: string }>(
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

export const getDeleteScriptConfirmationMessage = (selectedItems: LammpsScript[]): string => {
    if (selectedItems.length === 1) {
        return `Delete script "${selectedItems[0].title}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} scripts? This action cannot be undone.`;
};
