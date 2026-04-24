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
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { closeModal, openModal } from '@/shared/presentation/primitives';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import useFolderedListing, { type FolderedListingContext } from '@/shared/presentation/hooks/use-foldered-listing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { FOLDER_LIST_LIMIT, ROOT_FOLDER_ID } from '@/shared/presentation/constants/foldered-listing';
import { FileText, FolderInput, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { createEmptyDocumentsResponse, getDeleteConfirmationMessage } from '../utilities/documents';
import {
    createLatexDocumentRow,
    createLatexFolderRow,
    getLatexListingDraggableId,
    getLatexListingDroppableId,
    isLatexDocumentRow,
    isLatexFolderRow
} from '../utilities/listing';
import type { LatexDocument } from '@/modules/latex/api/entities/latex-document';
import type { LatexFolder } from '@/modules/latex/api/entities/latex-folder';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';
import type { LatexListingRow } from '@/modules/latex/utilities/listing';
import { useNavigate } from 'react-router-dom';
type LatexDocumentsListingDragAndDropConfig = DocumentListingDragAndDropConfig<LatexListingRow>;

interface LatexMoveTarget {
    _id: string;
    title: string;
    folder: string | null;
};

export const RENAME_LATEX_DOCUMENT_MODAL_ID = 'rename-latex-document-modal';
export const NEW_LATEX_FOLDER_MODAL_ID = 'new-latex-folder-modal';
export const RENAME_LATEX_FOLDER_MODAL_ID = 'rename-latex-folder-modal';
export const MOVE_LATEX_DOCUMENT_MODAL_ID = 'move-latex-document-modal';

const SOCKET_INVALIDATION: SocketInvalidationConfig[] = [
    { event: 'latex-document.deleted', queryKeys: [latexDocumentsQueryKey()] }
];

const DELETE_DOCUMENT_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Document', success: 'Document deleted successfully', error: 'Failed to delete document' });
const CREATE_DOCUMENT_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Document', success: 'Document created successfully', error: 'Failed to create document' });
const CREATE_FOLDER_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Folder', success: 'Folder created successfully', error: 'Failed to create folder' });
const RENAME_DOCUMENT_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Document', success: 'Document renamed successfully', error: 'Failed to rename document' });
const RENAME_FOLDER_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Folder', success: 'Folder renamed successfully', error: 'Failed to rename folder' });
const DELETE_FOLDER_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Folder', success: 'Folder deleted successfully', error: 'Failed to delete folder' });
const MOVE_DOCUMENT_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Document', success: 'Document moved successfully', error: 'Failed to move document' });

const fetchDocuments = (params: PaginationParams & FolderedListingContext): Promise<PaginatedResponse<LatexDocument>> => {
    return latexDocumentsQuery.fetch({
        page: params.page,
        limit: params.limit,
        folderId: params.folderId ?? ROOT_FOLDER_ID,
        ...(params.search ? { search: params.search } : {})
    });
};

const fetchFolders = (folderId: string | null): Promise<PaginatedResponse<LatexFolder>> => {
    return latexFoldersQuery.fetch({
        page: 1,
        limit: FOLDER_LIST_LIMIT,
        ...(folderId ? { parentId: folderId } : {})
    });
};

const fetchFolderById = (folderId: string): Promise<LatexFolder> => {
    return latexFolderQuery.fetch({ folderId });
};

const filterFoldersBySearch = (folders: LatexFolder[], search: string): LatexFolder[] => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
        return folders;
    }

    return folders.filter((folder) => folder.title.toLowerCase().includes(normalizedSearch));
};

const getDeleteFolderConfirmDescription = (folderTitle: string): string => {
    return `Delete "${folderTitle}"? Nested folders and all documents inside them will be deleted recursively.`;
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

    const [renamingDocument, setRenamingDocument] = useState<LatexDocument | null>(null);
    const [movingDocument, setMovingDocument] = useState<LatexMoveTarget | null>(null);
    const {
        breadcrumbs,
        context,
        currentFolder,
        currentFolderId,
        fetchData,
        getMoveFolder,
        goToRoot,
        handleCreateFolder,
        handleDeleteFolder,
        handleDeleteCurrentFolder,
        handleRenameFolderClose: handleRenameFolderStateClose,
        handleRenameFolderOpen: handleRenameFolderStateOpen,
        handleRenameFolderSubmit: handleRenameFolderStateSubmit,
        isInsideFolder,
        listMoveFolders,
        navigateToFolder,
        openFolder,
        renamingFolder
    } = useFolderedListing<LatexDocument, LatexFolder, LatexListingRow>({
        teamId,
        fetchItems: fetchDocuments,
        fetchFolders,
        getFolder: fetchFolderById,
        createEmptyResponse: createEmptyDocumentsResponse,
        mapFolderRow: createLatexFolderRow,
        mapItemRow: createLatexDocumentRow,
        filterFolders: filterFoldersBySearch,
        onFetchErrorTitle: 'Failed to fetch LaTeX documents',
        invalidFolderMessage: 'This LaTeX folder no longer exists. Showing Root instead.',
        createFolder,
        createFolderToast: CREATE_FOLDER_TOAST,
        updateFolder,
        renameFolderToast: RENAME_FOLDER_TOAST,
        deleteFolder,
        deleteFolderToast: DELETE_FOLDER_TOAST,
        getDeleteFolderConfirm: (folder) => ({
            title: getDeleteFolderConfirmDescription(folder.title),
            description: 'This permanently deletes the folder tree and every document contained in it.'
        })
    });

    const handleRenameFolderOpen = useCallback((folder: LatexFolder) => {
        handleRenameFolderStateOpen(folder);
        openModal(RENAME_LATEX_FOLDER_MODAL_ID);
    }, [handleRenameFolderStateOpen]);

    const handleRenameFolderClose = useCallback(() => {
        closeModal(RENAME_LATEX_FOLDER_MODAL_ID);
        handleRenameFolderStateClose();
    }, [handleRenameFolderStateClose]);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        await handleRenameFolderStateSubmit(title);
        closeModal(RENAME_LATEX_FOLDER_MODAL_ID);
    }, [handleRenameFolderStateSubmit]);

    const handleCreate = useCallback(async () => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createDocument({
                title: 'Untitled Document',
                folderId: currentFolderId
            }),
            CREATE_DOCUMENT_TOAST
        );
    }, [createDocument, currentFolderId, teamId]);

    const handleRenameOpen = useCallback((document: LatexDocument) => {
        setRenamingDocument(document);
        openModal(RENAME_LATEX_DOCUMENT_MODAL_ID);
    }, []);

    const handleRenameClose = useCallback(() => {
        closeModal(RENAME_LATEX_DOCUMENT_MODAL_ID);
        setRenamingDocument(null);
    }, []);

    const handleRenameSubmit = useCallback(async (title: string) => {
        if (!renamingDocument) {
            return;
        }

        await showPromise(
            updateDocument({ documentId: renamingDocument._id, title }),
            RENAME_DOCUMENT_TOAST
        );

        handleRenameClose();
    }, [handleRenameClose, renamingDocument, updateDocument]);

    const handleMoveDocumentOpen = useCallback((document: LatexDocument) => {
        setMovingDocument({
            _id: document._id,
            title: document.title,
            folder: document.folder
        });
        openModal(MOVE_LATEX_DOCUMENT_MODAL_ID);
    }, []);

    const handleMoveDocumentClose = useCallback(() => {
        closeModal(MOVE_LATEX_DOCUMENT_MODAL_ID);
        setMovingDocument(null);
    }, []);

    const handleMoveDocumentSubmit = useCallback(async (folderId: string | null) => {
        if (!movingDocument) {
            return;
        }

        await showPromise(
            moveDocument({
                documentId: movingDocument._id,
                folderId
            }),
            MOVE_DOCUMENT_TOAST
        );
    }, [moveDocument, movingDocument]);

    const handleDocumentRowDragEnd = useCallback(async (
        payload: Parameters<LatexDocumentsListingDragAndDropConfig['onDragEnd']>[0]
    ) => {
        const { activeItem, overItem } = payload;
        if (!activeItem || !overItem) {
            return;
        }

        if (!isLatexDocumentRow(activeItem) || !isLatexFolderRow(overItem)) {
            return;
        }

        if (activeItem.folder === overItem._id) {
            return;
        }

        await showPromise(
            moveDocument({
                documentId: activeItem._id,
                folderId: overItem._id
            }),
            MOVE_DOCUMENT_TOAST
        );
    }, [moveDocument]);

    const { getMenuOptions: getDocumentMenuOptions } = useListingActions<LatexDocument>({
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
            move: {
                label: 'Move to Folder',
                icon: FolderInput,
                handler: ({ item: document }) => {
                    handleMoveDocumentOpen(document);
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

    const { getMenuOptions: getFolderMenuOptions } = useListingActions<LatexFolder>({
        actions: {
            open: {
                label: 'Open Folder',
                icon: FolderOpen,
                handler: ({ item: folder }) => {
                    openFolder(folder._id);
                }
            },
            rename: {
                label: 'Rename Folder',
                icon: Pencil,
                handler: ({ item: folder }) => {
                    handleRenameFolderOpen(folder);
                },
                requiredPermission: 'latex:update'
            },
            delete: {
                label: 'Delete Folder',
                icon: Trash2,
                variant: 'danger',
                handler: async ({ item: folder }) => {
                    await handleDeleteFolder(folder);
                },
                requiredPermission: 'latex:delete'
            }
        }
    });

    const getMenuOptions = useCallback((item: LatexListingRow, selectedItems: LatexListingRow[]): MenuOption[] => {
        if (isLatexFolderRow(item)) {
            return getFolderMenuOptions(item, [item]);
        }

        const selectedDocuments = selectedItems.filter(isLatexDocumentRow);
        return getDocumentMenuOptions(item, selectedDocuments);
    }, [getDocumentMenuOptions, getFolderMenuOptions]);

    const handleItemClick = useCallback((item: LatexListingRow): boolean => {
        if (isLatexFolderRow(item)) {
            openFolder(item._id);
            return true;
        }

        navigate(`/dashboard/latex/${item._id}`);
        return true;
    }, [navigate, openFolder]);

    const dragAndDrop = useMemo<LatexDocumentsListingDragAndDropConfig | undefined>(() => {
        if (!canMoveDocuments) {
            return undefined;
        }

        return {
            activationDistance: 6,
            getDraggableId: getLatexListingDraggableId,
            getDroppableId: getLatexListingDroppableId,
            onDragEnd: handleDocumentRowDragEnd
        };
    }, [canMoveDocuments, handleDocumentRowDragEnd]);

    return {
        breadcrumbs,
        context,
        currentFolder,
        dragAndDrop,
        fetchData,
        getMenuOptions,
        getMoveFolder,
        goToRoot,
        handleCreate,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleItemClick,
        handleMoveDocumentClose,
        handleMoveDocumentSubmit,
        handleRenameClose,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        handleRenameSubmit,
        isInsideFolder,
        listMoveFolders,
        movingDocument,
        navigateToFolder,
        queryKey: latexDocumentsQueryKey(),
        renamingDocument,
        renamingFolder,
        socketInvalidation: SOCKET_INVALIDATION
    };
};

export default useLatexDocumentsListing;
