import {
    latexFolderQuery,
    latexFoldersQuery,
    latexDocumentsQuery,
    latexDocumentsQueryKey,
    useCreateLatexDocumentMutation,
    useCreateLatexFolderMutation,
    useDeleteLatexDocumentMutation,
    useDeleteLatexFolderMutation,
    useMoveLatexDocumentMutation,
    useUpdateLatexDocumentMutation,
    useUpdateLatexFolderMutation
} from '@/modules/latex/hooks/queries';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import { SOCKET_LATEX_DOCUMENT_EVENTS } from '@/modules/socket/events/latex';
import useFolderedResourceListing from '@/shared/presentation/hooks/use-foldered-resource-listing';
import {
    createFolderedResourceFetchers,
    createFolderResourceDeleteConfirm,
    FOLDER_RESOURCE_TOASTS
} from '@/shared/presentation/hooks/foldered-resource-listing-helpers';
import type { ActionConfig } from '@/shared/presentation/hooks/use-listing-actions';
import useRenameEntityModal from '@/shared/presentation/hooks/use-rename-entity-modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { FileText, FolderInput, Pencil } from 'lucide-react';
import { useCallback } from 'react';
import { getDeleteConfirmationMessage } from '../utilities/documents';
import {
    createLatexDocumentRow,
    createLatexFolderRow,
    getLatexListingDraggableId,
    getLatexListingDroppableId,
    isLatexDocumentRow,
    isLatexFolderRow,
    type LatexDocumentRow
} from '../utilities/listing';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';
import type { LatexFolder } from '@/modules/latex/api/entities/latex-folder';
import { useNavigate } from 'react-router-dom';

interface LatexMoveTarget {
    _id: string;
    title: string;
    folder: string | null;
}

const getLatexMoveTarget = (document: LatexDocument): LatexMoveTarget => ({
    _id: document._id,
    title: document.title,
    folder: document.folder
});

export const RENAME_LATEX_DOCUMENT_MODAL_ID = 'rename-latex-document-modal';
export const NEW_LATEX_FOLDER_MODAL_ID = 'new-latex-folder-modal';
export const RENAME_LATEX_FOLDER_MODAL_ID = 'rename-latex-folder-modal';
export const MOVE_LATEX_DOCUMENT_MODAL_ID = 'move-latex-document-modal';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: SOCKET_LATEX_DOCUMENT_EVENTS.DELETED, queryKeys: [latexDocumentsQueryKey()] }
];

const DELETE_DOCUMENT_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Document' });
const CREATE_DOCUMENT_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Document' });
const RENAME_DOCUMENT_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Document' });
const MOVE_DOCUMENT_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Document' });

const documentFetchers = createFolderedResourceFetchers({
    listItems: latexDocumentsQuery.fetch,
    listFolders: latexFoldersQuery.fetch,
    getFolder: latexFolderQuery.fetch
});

const getDeleteFolderConfirm = createFolderResourceDeleteConfirm({
    pluralName: 'documents',
    singularName: 'document'
});

const filterFoldersBySearch = (folders: LatexFolder[], search: string): LatexFolder[] => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
        return folders;
    }

    return folders.filter((folder) => folder.title.toLowerCase().includes(normalizedSearch));
};

const useLatexDocumentsListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();
    const canMoveDocuments = canAccess(['latex:update']);
    const { mutateAsync: deleteDocument } = useDeleteLatexDocumentMutation();
    const { mutateAsync: createDocument } = useCreateLatexDocumentMutation();
    const { mutateAsync: updateDocument } = useUpdateLatexDocumentMutation();
    const { mutateAsync: createFolder } = useCreateLatexFolderMutation();
    const { mutateAsync: updateFolder } = useUpdateLatexFolderMutation();
    const { mutateAsync: deleteFolder } = useDeleteLatexFolderMutation();
    const { mutateAsync: moveDocument } = useMoveLatexDocumentMutation();

    const {
        renamingEntity: renamingDocument,
        handleRenameOpen,
        handleRenameClose,
        handleRenameSubmit
    } = useRenameEntityModal({
        modalId: RENAME_LATEX_DOCUMENT_MODAL_ID,
        updateEntity: updateDocument,
        getUpdateParams: (document: LatexDocument, title) => ({ documentId: document._id, title }),
        renameToast: RENAME_DOCUMENT_TOAST
    });

    const moveDocumentToFolder = useCallback((documentId: string, folderId: string | null) => {
        return moveDocument({ documentId, folderId });
    }, [moveDocument]);

    const openDocument = useCallback((document: LatexDocument) => {
        navigate(`/dashboard/latex/${document._id}`);
    }, [navigate]);

    const getDocumentActions = useCallback(({ openMove }: { openMove: (document: LatexDocumentRow) => void }): Record<string, ActionConfig<LatexDocumentRow>> => ({
        open: {
            label: 'Open Document',
            icon: FileText,
            handler: ({ item: document }) => openDocument(document),
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
        move: {
            label: 'Move to Folder',
            icon: FolderInput,
            handler: ({ item: document }) => {
                openMove(document);
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
    }), [deleteDocument, handleRenameOpen, openDocument]);

    const {
        handleMoveClose,
        handleMoveSubmit,
        movingItem,
        ...folderedListing
    } = useFolderedResourceListing({
        teamId,
        ...documentFetchers,
        mapFolderRow: createLatexFolderRow,
        mapItemRow: createLatexDocumentRow,
        filterFolders: filterFoldersBySearch,
        onFetchErrorTitle: 'Failed to fetch LaTeX documents',
        invalidFolderMessage: 'This LaTeX folder no longer exists. Showing Root instead.',
        createFolder,
        createFolderToast: FOLDER_RESOURCE_TOASTS.create,
        updateFolder,
        renameFolderToast: FOLDER_RESOURCE_TOASTS.rename,
        deleteFolder,
        deleteFolderToast: FOLDER_RESOURCE_TOASTS.delete,
        getDeleteFolderConfirm,
        renameFolderModalId: RENAME_LATEX_FOLDER_MODAL_ID,
        moveModalId: MOVE_LATEX_DOCUMENT_MODAL_ID,
        canMoveItems: canMoveDocuments,
        activationDistance: 6,
        getDraggableId: getLatexListingDraggableId,
        getDroppableId: getLatexListingDroppableId,
        isItemRow: isLatexDocumentRow,
        isFolderRow: isLatexFolderRow,
        getMoveTarget: getLatexMoveTarget,
        moveItem: moveDocumentToFolder,
        moveToast: MOVE_DOCUMENT_TOAST,
        folderPermissions: {
            rename: 'latex:update',
            delete: 'latex:delete'
        },
        getItemActions: getDocumentActions,
        onOpenItem: openDocument
    });

    const handleCreate = useCallback(async () => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createDocument({
                title: 'Untitled Document',
                folderId: folderedListing.currentFolderId
            }),
            CREATE_DOCUMENT_TOAST
        );
    }, [createDocument, folderedListing.currentFolderId, teamId]);

    return {
        ...folderedListing,
        handleCreate,
        handleMoveDocumentClose: handleMoveClose,
        handleMoveDocumentSubmit: handleMoveSubmit,
        handleRenameClose,
        handleRenameSubmit,
        movingDocument: movingItem,
        queryKey: latexDocumentsQueryKey(),
        renamingDocument,
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useLatexDocumentsListing;
