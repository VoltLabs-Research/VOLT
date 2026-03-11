import {
    invalidateLatexDocumentsQuery,
    invalidateLatexFoldersQuery,
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
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { isAccessDeniedError } from '@/shared/errors/notify-api-error';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import { ConfirmActionTone } from '@/shared/presentation/hooks/use-confirm';
import type { SocketInvalidationConfig } from '@/shared/presentation/components/DocumentListing';
import useFolderSearchParam from '@/shared/presentation/hooks/use-folder-search-param';
import useFolderBreadcrumbs from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import usePermission from '@/shared/presentation/hooks/use-permission';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { runAction } from '@/shared/presentation/actions/run-action';
import type { MenuOption } from '@/shared/presentation/types/menu';
import { FileText, FolderInput, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { sileo } from 'sileo';
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

interface LatexDocumentsListingContext {
    folderId: string | null;
};

type LatexDocumentsListingDragAndDropConfig = DocumentListingDragAndDropConfig<LatexListingRow>;

interface LatexMoveTarget {
    _id: string;
    title: string;
    folder: string | null;
};

const FOLDER_LIST_LIMIT = 500;
const ROOT_FOLDER_ID = 'root';

export const RENAME_LATEX_DOCUMENT_MODAL_ID = 'rename-latex-document-modal';
export const NEW_LATEX_FOLDER_MODAL_ID = 'new-latex-folder-modal';
export const RENAME_LATEX_FOLDER_MODAL_ID = 'rename-latex-folder-modal';
export const MOVE_LATEX_DOCUMENT_MODAL_ID = 'move-latex-document-modal';

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

const CREATE_FOLDER_TOAST = {
    loading: { title: 'Creating folder...' },
    success: { title: 'Folder created successfully' },
    error: { title: 'Failed to create folder' }
};

const RENAME_DOCUMENT_TOAST = {
    loading: { title: 'Renaming document...' },
    success: { title: 'Document renamed successfully' },
    error: { title: 'Failed to rename document' }
};

const RENAME_FOLDER_TOAST = {
    loading: { title: 'Renaming folder...' },
    success: { title: 'Folder renamed successfully' },
    error: { title: 'Failed to rename folder' }
};

const DELETE_FOLDER_TOAST = {
    loading: { title: 'Deleting folder...' },
    success: { title: 'Folder deleted successfully' },
    error: { title: 'Failed to delete folder' }
};

const MOVE_DOCUMENT_TOAST = {
    loading: { title: 'Moving document...' },
    success: { title: 'Document moved successfully' },
    error: { title: 'Failed to move document' }
};

const fetchDocuments = (params: PaginationParams & LatexDocumentsListingContext): Promise<PaginatedResponse<LatexDocument>> => {
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
    return `Delete "${folderTitle}"? Nested folders will be removed and any documents inside them will be moved to Root.`;
};

const useLatexDocumentsListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const canMoveDocuments = usePermission(['latex:update']);
    const { currentFolderId, isInsideFolder, openFolder, goToRoot } = useFolderSearchParam();
    const { mutateAsync: deleteDocument } = useDeleteLatexDocumentMutation();
    const { mutateAsync: createDocument } = useCreateLatexDocumentMutation();
    const { mutateAsync: updateDocument } = useUpdateLatexDocumentMutation();
    const { mutateAsync: createFolder } = useCreateLatexFolderMutation();
    const { mutateAsync: updateFolder } = useUpdateLatexFolderMutation();
    const { mutateAsync: deleteFolder } = useDeleteLatexFolderMutation();
    const { mutateAsync: moveDocument } = useMoveLatexDocumentMutation();
    const context = useMemo(() => ({ folderId: currentFolderId }), [currentFolderId]);

    const [renamingDocument, setRenamingDocument] = useState<LatexDocument | null>(null);
    const [renamingFolder, setRenamingFolder] = useState<LatexFolder | null>(null);
    const [movingDocument, setMovingDocument] = useState<LatexMoveTarget | null>(null);
    const [folderRefreshKey, setFolderRefreshKey] = useState(0);

    const { breadcrumbs, currentFolder } = useFolderBreadcrumbs<LatexFolder>({
        currentFolderId,
        getFolder: fetchFolderById,
        onInvalidFolder: goToRoot,
        refreshKey: folderRefreshKey,
        invalidFolderMessage: 'This LaTeX folder no longer exists. Showing Root instead.'
    });

    const fetchData = useCallback(async (
        params: PaginationParams & LatexDocumentsListingContext
    ): Promise<PaginatedResponse<LatexListingRow>> => {
        if (!teamId) {
            return createEmptyDocumentsResponse(params);
        }

        try {
            const [documentsResponse, foldersResponse] = await Promise.all([
                fetchDocuments(params),
                params.page === 1 ? fetchFolders(params.folderId ?? null) : Promise.resolve(null)
            ]);

            const filteredFolders = filterFoldersBySearch(foldersResponse?.data || [], params.search ?? '');
            const folderRows = filteredFolders.map(createLatexFolderRow);
            const documentRows = (documentsResponse.data || []).map(createLatexDocumentRow);

            return {
                ...documentsResponse,
                data: params.page === 1
                    ? [...folderRows, ...documentRows]
                    : documentRows
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
        if (!teamId) {
            return;
        }

        await showPromise(
            (async () => {
                await createDocument({
                    title: 'Untitled Document',
                    folderId: currentFolderId
                });

                await invalidateLatexDocumentsQuery();
            })(),
            CREATE_DOCUMENT_TOAST
        );
    }, [createDocument, currentFolderId, teamId]);

    const handleCreateFolder = useCallback(async (title: string) => {
        if (!teamId) {
            return;
        }

        await showPromise(
            createFolder({
                title,
                parentId: currentFolderId
            }).then(async () => {
                await Promise.all([
                    invalidateLatexFoldersQuery(),
                    invalidateLatexDocumentsQuery()
                ]);
            }),
            CREATE_FOLDER_TOAST
        );
    }, [createFolder, currentFolderId, teamId]);

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

    const handleRenameFolderOpen = useCallback((folder: LatexFolder) => {
        setRenamingFolder(folder);
        openModal(RENAME_LATEX_FOLDER_MODAL_ID);
    }, []);

    const handleRenameFolderClose = useCallback(() => {
        closeModal(RENAME_LATEX_FOLDER_MODAL_ID);
        setRenamingFolder(null);
    }, []);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        if (!renamingFolder) {
            return;
        }

        await showPromise(
            updateFolder({
                folderId: renamingFolder._id,
                title
            }),
            RENAME_FOLDER_TOAST
        );

        setFolderRefreshKey((previousValue) => previousValue + 1);
        handleRenameFolderClose();
    }, [handleRenameFolderClose, renamingFolder, updateFolder]);

    const handleDeleteFolder = useCallback(async (folder: LatexFolder) => {
        await runAction({
            action: () => deleteFolder({ folderId: folder._id }),
            confirm: {
                title: getDeleteFolderConfirmDescription(folder.title),
                description: 'Nested folders are deleted recursively. Documents inside deleted folders are moved to Root.',
                confirmText: 'Delete Folder',
                cancelText: 'Cancel',
                tone: ConfirmActionTone.Danger
            },
            toast: DELETE_FOLDER_TOAST,
            afterSuccess: async () => {
                setFolderRefreshKey((previousValue) => previousValue + 1);

                if (currentFolderId === folder._id) {
                    if (folder.parent) {
                        openFolder(folder.parent);
                        return;
                    }

                    goToRoot();
                }
            }
        });
    }, [currentFolderId, deleteFolder, goToRoot, openFolder]);

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
        if (!isLatexFolderRow(item)) {
            return false;
        }

        openFolder(item._id);
        return true;
    }, [openFolder]);

    const listMoveFolders = useCallback(async (folderId: string | null) => {
        const response = await fetchFolders(folderId);
        return response.data;
    }, []);

    const getMoveFolder = useCallback((folderId: string) => fetchFolderById(folderId), []);
    const navigateToFolder = useCallback((folderId: string | null) => {
        if (folderId) {
            openFolder(folderId);
            return;
        }

        goToRoot();
    }, [goToRoot, openFolder]);

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
        handleDeleteCurrentFolder: currentFolder ? () => handleDeleteFolder(currentFolder) : null,
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
