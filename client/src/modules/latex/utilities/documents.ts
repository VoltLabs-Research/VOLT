import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';
import { createEmptyPaginatedResponse } from '@/shared/domain/pagination';

export const createEmptyDocumentsResponse = createEmptyPaginatedResponse;

export const getDeleteConfirmationMessage = (selectedItems: LatexDocument[]): string => {
    if (selectedItems.length === 1) {
        return `Delete document "${selectedItems[0].title || 'Untitled Document'}"? This action cannot be undone.`;
    }

    return `Delete ${selectedItems.length} documents? This action cannot be undone.`;
};
