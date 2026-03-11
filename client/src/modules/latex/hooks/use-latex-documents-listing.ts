import { isAccessDeniedError } from '@/shared/errors/notify-api-error';
import {
    latexDocumentsQuery,
    latexDocumentsQueryKey,
    useCreateLatexDocumentMutation,
    useDeleteLatexDocumentMutation,
    useUpdateLatexDocumentMutation
} from '@/modules/latex/hooks/queries';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { openModal, closeModal } from '@/shared/presentation/components/Modal';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import { FileText, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
import { createEmptyDocumentsResponse, getDeleteConfirmationMessage } from '../utilities/documents';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';

export const RENAME_LATEX_DOCUMENT_MODAL_ID = 'rename-latex-document-modal';

const fetchDocuments = (params: PaginationParams): Promise<PaginatedResponse<LatexDocument>> => {
    return latexDocumentsQuery.fetch({
        page: params.page,
        limit: params.limit
    });
};

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'latex-document.deleted', queryKeys: [latexDocumentsQueryKey()] }
];

const DELETE_DOCUMENT_TOAST = {
    loading: { title: 'Deleting document...' },
    success: { title: 'Document deleted successfully' },
    error: { title: 'Failed to delete document' }
};

const CREATE_DOCUMENT_TOAST = {
    loading: { title: 'Creating document...' },
    success: { title: 'Document created successfully' },
    error: { title: 'Failed to create document' }
};

const RENAME_DOCUMENT_TOAST = {
    loading: { title: 'Renaming document...' },
    success: { title: 'Document renamed successfully' },
    error: { title: 'Failed to rename document' }
};

const useLatexDocumentsListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { mutateAsync: deleteDocument } = useDeleteLatexDocumentMutation();
    const { mutateAsync: createDocument } = useCreateLatexDocumentMutation();
    const { mutateAsync: updateDocument } = useUpdateLatexDocumentMutation();

    const [renamingDocument, setRenamingDocument] = useState<LatexDocument | null>(null);

    const fetchData = useCallback(async (params: PaginationParams): Promise<PaginatedResponse<LatexDocument>> => {
        if (!teamId) {
            return createEmptyDocumentsResponse(params);
        }

        try {
            const result = await fetchDocuments(params);

            return {
                ...result,
                data: result.data || []
            };
        } catch (error) {
            if (isAccessDeniedError(error)) {
                throw error;
            }

            sileo.error({ title: 'Failed to fetch LaTeX documents' });
            return createEmptyDocumentsResponse(params);
        }
    }, [teamId]);

    const handleCreate = useCallback(async () => {
        await showPromise(
            createDocument({ title: 'Untitled Document' }),
            CREATE_DOCUMENT_TOAST
        );
    }, [createDocument]);

    const handleRenameOpen = useCallback((document: LatexDocument) => {
        setRenamingDocument(document);
        openModal(RENAME_LATEX_DOCUMENT_MODAL_ID);
    }, []);

    const handleRenameClose = useCallback(() => {
        closeModal(RENAME_LATEX_DOCUMENT_MODAL_ID);
        setRenamingDocument(null);
    }, []);

    const handleRenameSubmit = useCallback(async (title: string) => {
        if (!renamingDocument) return;

        await showPromise(
            updateDocument({ documentId: renamingDocument._id, title }),
            RENAME_DOCUMENT_TOAST
        );

        handleRenameClose();
    }, [renamingDocument, updateDocument, handleRenameClose]);

    const { getMenuOptions } = useListingActions<LatexDocument>({
        actions: {
            open: {
                label: 'Open Document',
                icon: FileText,
                handler: ({ item: document }) => {
                    navigate(`/dashboard/latex/${document._id}`);
                },
                requiredPermission: 'latex:read'
            },
            rename: {
                label: 'Rename',
                icon: Pencil,
                handler: ({ item: document }) => {
                    handleRenameOpen(document);
                },
                requiredPermission: 'latex:update'
            },
            delete: {
                variant: 'danger',
                handler: async ({ item: document }) => {
                    await showPromise(
                        deleteDocument({ documentId: document._id }),
                        DELETE_DOCUMENT_TOAST
                    );
                },
                confirm: ({ selectedItems }) => getDeleteConfirmationMessage(selectedItems),
                requiredPermission: 'latex:delete'
            }
        }
    });

    return {
        fetchData,
        getMenuOptions,
        handleCreate,
        handleRenameClose,
        handleRenameSubmit,
        renamingDocument,
        queryKey: latexDocumentsQueryKey(),
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useLatexDocumentsListing;
