import {
    lammpsContainersQuery,
    lammpsFolderQuery,
    lammpsFoldersQuery,
    lammpsScriptsQuery,
    lammpsScriptsQueryKey,
    useCreateLammpsFolderMutation,
    useCreateLammpsScriptMutation,
    useDeleteLammpsFolderMutation,
    useDeleteLammpsScriptMutation,
    useMoveLammpsScriptMutation,
    useUpdateLammpsFolderMutation,
    useUpdateLammpsScriptMutation
} from '@/modules/lammps/hooks/queries';
import {
    createLammpsFolderRow,
    createLammpsScriptRow,
    getLammpsListingDraggableId,
    getLammpsListingDroppableId,
    isLammpsFolderRow,
    isLammpsScriptRow,
    type LammpsListingRow
} from '@/modules/lammps/utilities/listing';
import { createEmptyLammpsResponse, getDeleteScriptConfirmationMessage } from '@/modules/lammps/utilities/documents';
import useTeamPermissions from '@/modules/team/hooks/team/use-team-permissions';
import { useSelectedTeamId } from '@/modules/team/hooks/team/use-selected-team';
import { closeModal, openModal } from '@/shared/presentation/components/Modal';
import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import useFolderedListing, { type FolderedListingContext } from '@/shared/presentation/hooks/use-foldered-listing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import type { PaginationParams } from '@/shared/presentation/hooks/use-pagination-params';
import { showPromise } from '@/shared/presentation/hooks/toast';
import { createCrudToastOptions } from '@/shared/presentation/toast-options';
import { FOLDER_LIST_LIMIT } from '@/shared/presentation/constants/foldered-listing';
import { FileCode2, FolderInput, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LammpsContainer, LammpsFolder, LammpsScript } from '@/modules/lammps/api/types';
import type { PaginatedResponse } from '@/shared/domain/pagination/PaginationResponse';

export const CREATE_LAMMPS_SCRIPT_MODAL_ID = 'create-lammps-script-modal';
export const RENAME_LAMMPS_SCRIPT_MODAL_ID = 'rename-lammps-script-modal';
export const NEW_LAMMPS_FOLDER_MODAL_ID = 'new-lammps-folder-modal';
export const RENAME_LAMMPS_FOLDER_MODAL_ID = 'rename-lammps-folder-modal';
export const MOVE_LAMMPS_SCRIPT_MODAL_ID = 'move-lammps-script-modal';

interface MoveTarget {
    _id: string;
    title: string;
    folder: string | null;
}

const CREATE_FOLDER_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Folder', success: 'Folder created successfully', error: 'Failed to create folder' });
const RENAME_FOLDER_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Folder', success: 'Folder renamed successfully', error: 'Failed to rename folder' });
const DELETE_FOLDER_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Folder', success: 'Folder deleted successfully', error: 'Failed to delete folder' });
const CREATE_SCRIPT_TOAST = createCrudToastOptions({ action: 'Creating', subject: 'Script', success: 'Script created successfully', error: 'Failed to create script' });
const RENAME_SCRIPT_TOAST = createCrudToastOptions({ action: 'Renaming', subject: 'Script', success: 'Script renamed successfully', error: 'Failed to rename script' });
const MOVE_SCRIPT_TOAST = createCrudToastOptions({ action: 'Moving', subject: 'Script', success: 'Script moved successfully', error: 'Failed to move script' });
const DELETE_SCRIPT_TOAST = createCrudToastOptions({ action: 'Deleting', subject: 'Script', success: 'Script deleted successfully', error: 'Failed to delete script' });

const fetchScripts = (
    teamId: string,
    params: PaginationParams & FolderedListingContext
): Promise<PaginatedResponse<LammpsScript>> => {
    return lammpsScriptsQuery.fetch({
        teamId,
        page: params.page,
        limit: params.limit,
        search: params.search || undefined,
        folderId: params.folderId ?? null
    });
};

const fetchFolders = (teamId: string, folderId: string | null): Promise<PaginatedResponse<LammpsFolder>> => {
    return lammpsFoldersQuery.fetch({
        teamId,
        page: 1,
        limit: FOLDER_LIST_LIMIT,
        parentId: folderId ?? null
    });
};

const useLammpsScriptsListing = () => {
    const navigate = useNavigate();
    const teamId = useSelectedTeamId();
    const { canAccess } = useTeamPermissions();
    const canCreate = canAccess(['lammps:create']);
    const createFolderMutation = useCreateLammpsFolderMutation();
    const updateFolderMutation = useUpdateLammpsFolderMutation();
    const deleteFolderMutation = useDeleteLammpsFolderMutation();
    const createScriptMutation = useCreateLammpsScriptMutation();
    const updateScriptMutation = useUpdateLammpsScriptMutation();
    const moveScriptMutation = useMoveLammpsScriptMutation();
    const deleteScriptMutation = useDeleteLammpsScriptMutation();

    const [renamingScript, setRenamingScript] = useState<LammpsScript | null>(null);
    const [movingScript, setMovingScript] = useState<MoveTarget | null>(null);

    const readyContainersQuery = lammpsContainersQuery({
        teamId: teamId ?? '',
        page: 1,
        limit: 100
    }, {
        enabled: Boolean(teamId)
    });

    const readyContainers = useMemo<LammpsContainer[]>(() => {
        return (readyContainersQuery.data?.data ?? []).filter((container) => container.status === 'ready');
    }, [readyContainersQuery.data?.data]);

    const {
        breadcrumbs,
        context,
        currentFolder,
        currentFolderId,
        fetchData,
        getMoveFolder,
        handleCreateFolder,
        handleDeleteCurrentFolder,
        handleRenameFolderClose: handleRenameFolderStateClose,
        handleRenameFolderOpen: handleRenameFolderStateOpen,
        handleRenameFolderSubmit: handleRenameFolderStateSubmit,
        listMoveFolders,
        navigateToFolder,
        openFolder,
        renamingFolder
    } = useFolderedListing<LammpsScript, LammpsFolder, LammpsListingRow>({
        teamId,
        fetchItems: (params) => {
            if (!teamId) {
                return Promise.resolve(createEmptyLammpsResponse(params));
            }

            return fetchScripts(teamId, params);
        },
        fetchFolders: (folderId) => {
            if (!teamId) {
                return Promise.resolve(createEmptyLammpsResponse({ page: 1, limit: FOLDER_LIST_LIMIT, search: '' }));
            }

            return fetchFolders(teamId, folderId);
        },
        getFolder: (folderId) => lammpsFolderQuery.fetch({ teamId: teamId ?? '', folderId }),
        createEmptyResponse: createEmptyLammpsResponse,
        mapFolderRow: createLammpsFolderRow,
        mapItemRow: createLammpsScriptRow,
        onFetchErrorTitle: 'Failed to fetch LAMMPS scripts',
        invalidFolderMessage: 'This LAMMPS folder no longer exists. Showing Root instead.',
        createFolder: ({ title, parentId }) => {
            if (!teamId) {
                return Promise.resolve();
            }

            return createFolderMutation.mutateAsync({
                teamId,
                title,
                parentId
            });
        },
        createFolderToast: CREATE_FOLDER_TOAST,
        updateFolder: ({ folderId, title }) => {
            if (!teamId) {
                return Promise.resolve();
            }

            return updateFolderMutation.mutateAsync({
                teamId,
                folderId,
                title
            });
        },
        renameFolderToast: RENAME_FOLDER_TOAST,
        deleteFolder: ({ folderId }) => {
            if (!teamId) {
                return Promise.resolve();
            }

            return deleteFolderMutation.mutateAsync({
                teamId,
                folderId
            });
        },
        deleteFolderToast: DELETE_FOLDER_TOAST,
        getDeleteFolderConfirm: (folder) => ({
            title: `Delete "${folder.title}"?`,
            description: 'Nested folders and all scripts inside them will be deleted recursively.'
        })
    });

    const handleRenameFolderOpen = useCallback((folder: LammpsFolder) => {
        handleRenameFolderStateOpen(folder);
        openModal(RENAME_LAMMPS_FOLDER_MODAL_ID);
    }, [handleRenameFolderStateOpen]);

    const handleRenameFolderClose = useCallback(() => {
        closeModal(RENAME_LAMMPS_FOLDER_MODAL_ID);
        handleRenameFolderStateClose();
    }, [handleRenameFolderStateClose]);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        await handleRenameFolderStateSubmit(title);
        closeModal(RENAME_LAMMPS_FOLDER_MODAL_ID);
    }, [handleRenameFolderStateSubmit]);

    const handleCreateScript = useCallback(async (payload: { title: string; containerId: string }) => {
        if (!teamId) {
            return;
        }

        await showPromise(createScriptMutation.mutateAsync({
            teamId,
            title: payload.title,
            containerId: payload.containerId,
            folderId: currentFolderId
        }), CREATE_SCRIPT_TOAST);
    }, [createScriptMutation, currentFolderId, teamId]);

    const handleRenameScriptOpen = useCallback((script: LammpsScript) => {
        setRenamingScript(script);
        openModal(RENAME_LAMMPS_SCRIPT_MODAL_ID);
    }, []);

    const handleRenameScriptClose = useCallback(() => {
        closeModal(RENAME_LAMMPS_SCRIPT_MODAL_ID);
        setRenamingScript(null);
    }, []);

    const handleRenameScriptSubmit = useCallback(async (title: string) => {
        if (!teamId || !renamingScript) {
            return;
        }

        await showPromise(updateScriptMutation.mutateAsync({
            teamId,
            scriptId: renamingScript._id,
            title
        }), RENAME_SCRIPT_TOAST);
        handleRenameScriptClose();
    }, [handleRenameScriptClose, renamingScript, teamId, updateScriptMutation]);

    const handleMoveScriptOpen = useCallback((script: LammpsScript) => {
        setMovingScript({
            _id: script._id,
            title: script.title,
            folder: script.folder
        });
        openModal(MOVE_LAMMPS_SCRIPT_MODAL_ID);
    }, []);

    const handleMoveScriptClose = useCallback(() => {
        closeModal(MOVE_LAMMPS_SCRIPT_MODAL_ID);
        setMovingScript(null);
    }, []);

    const handleMoveScriptSubmit = useCallback(async (folderId: string | null) => {
        if (!teamId || !movingScript) {
            return;
        }

        await showPromise(moveScriptMutation.mutateAsync({
            teamId,
            scriptId: movingScript._id,
            folderId
        }), MOVE_SCRIPT_TOAST);
    }, [moveScriptMutation, movingScript, teamId]);

    const handleDeleteScript = useCallback(async (script: LammpsScript) => {
        if (!teamId) {
            return;
        }

        await showPromise(deleteScriptMutation.mutateAsync({
            teamId,
            scriptId: script._id
        }), DELETE_SCRIPT_TOAST);
    }, [deleteScriptMutation, teamId]);

    const handleOpenScript = useCallback((scriptId: string) => {
        navigate(`/dashboard/lammps/scripts/${scriptId}`);
    }, [navigate]);

    const handleItemClick = useCallback((item: LammpsListingRow) => {
        if (isLammpsFolderRow(item)) {
            openFolder(item._id);
            return true;
        }

        handleOpenScript(item._id);
        return true;
    }, [handleOpenScript, openFolder]);

    const handleRowDragEnd = useCallback(async (
        payload: Parameters<DocumentListingDragAndDropConfig<LammpsListingRow>['onDragEnd']>[0]
    ) => {
        const { activeItem, overItem } = payload;
        if (!teamId || !activeItem || !overItem || !isLammpsScriptRow(activeItem) || !isLammpsFolderRow(overItem)) {
            return;
        }

        if (activeItem.folder === overItem._id) {
            return;
        }

        await showPromise(moveScriptMutation.mutateAsync({
            teamId,
            scriptId: activeItem._id,
            folderId: overItem._id
        }), MOVE_SCRIPT_TOAST);
    }, [moveScriptMutation, teamId]);

    const { getMenuOptions: getScriptMenuOptions } = useListingActions<LammpsScript>({
        actions: {
            open: {
                label: 'Open project',
                icon: FileCode2,
                requiredPermission: 'lammps:read',
                handler: ({ item }) => handleOpenScript(item._id)
            },
            rename: {
                label: 'Rename',
                icon: Pencil,
                requiredPermission: 'lammps:update',
                handler: ({ item }) => handleRenameScriptOpen(item)
            },
            move: {
                label: 'Move to folder',
                icon: FolderInput,
                requiredPermission: 'lammps:update',
                handler: ({ item }) => handleMoveScriptOpen(item)
            },
            delete: {
                label: 'Delete',
                icon: Trash2,
                variant: 'danger',
                requiredPermission: 'lammps:delete',
                confirm: ({ selectedItems }) => getDeleteScriptConfirmationMessage(selectedItems),
                handler: async ({ item }) => handleDeleteScript(item)
            }
        }
    });

    const getMenuOptions = useCallback((item: LammpsListingRow, selectedItems: LammpsListingRow[]) => {
        if (isLammpsFolderRow(item)) {
            return [
                {
                    label: 'Open folder',
                    icon: FolderOpen,
                    onClick: () => openFolder(item._id)
                }
            ];
        }

        const selectedScripts = selectedItems.filter(isLammpsScriptRow);
        return getScriptMenuOptions(item, selectedScripts.length > 0 ? selectedScripts : [item]);
    }, [getScriptMenuOptions, openFolder]);

    const dragAndDrop = useMemo<DocumentListingDragAndDropConfig<LammpsListingRow> | undefined>(() => {
        if (!canAccess(['lammps:update'])) {
            return undefined;
        }

        return {
            getDraggableId: getLammpsListingDraggableId,
            getDroppableId: getLammpsListingDroppableId,
            onDragEnd: handleRowDragEnd
        };
    }, [canAccess, handleRowDragEnd]);

    return {
        breadcrumbs,
        canCreate,
        containers: readyContainers,
        context,
        currentFolder,
        dragAndDrop,
        fetchData,
        getMenuOptions,
        getMoveFolder,
        handleCreateFolder,
        handleCreateScript,
        handleDeleteCurrentFolder,
        handleMoveScriptClose,
        handleMoveScriptSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        handleRenameScriptClose,
        handleRenameScriptSubmit,
        handleItemClick,
        listMoveFolders,
        movingScript,
        navigateToFolder,
        queryKey: lammpsScriptsQueryKey(),
        renamingFolder,
        renamingScript,
        teamId
    };
};

export default useLammpsScriptsListing;
