import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import type { Identifiable } from '@/shared/presentation/components/DocumentListingTable';
import { closeModal, openModal } from '@/shared/presentation/primitives/Modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { FolderBreadcrumbEntity } from '@/shared/presentation/hooks/use-folder-breadcrumbs';
import useFolderedListing from '@/shared/presentation/hooks/use-foldered-listing';
import type { UseFolderedListingOptions } from '@/shared/presentation/hooks/use-foldered-listing';
import useListingActions from '@/shared/presentation/hooks/use-listing-actions';
import type { ActionConfig } from '@/shared/presentation/hooks/use-listing-actions';
import type { MenuOption } from '@/shared/presentation/types/menu';
import type { PromiseToastOptions } from '@/shared/presentation/toast-options';
import { FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

interface FolderActionPermissions {
    rename?: string;
    delete?: string;
}

interface FolderedMoveEntity extends Identifiable {
    folder: string | null;
}

interface FolderedItemActionHelpers<TItemRow> {
    openMove: (item: TItemRow) => void;
}

interface FolderedItemMenuPayload<TItemRow> {
    item: TItemRow;
    selectedItems: TItemRow[];
}

interface UseFolderedResourceListingOptions<
    TItem,
    TFolder extends FolderBreadcrumbEntity,
    TRow extends Identifiable,
    TItemRow extends TItem & TRow & FolderedMoveEntity,
    TFolderRow extends TRow,
    TMoveTarget extends FolderedMoveEntity
> extends UseFolderedListingOptions<TItem, TFolder, TRow> {
    renameFolderModalId: string;
    moveModalId: string;
    canMoveItems: boolean;
    activationDistance: number;
    getDraggableId: DocumentListingDragAndDropConfig<TRow>['getDraggableId'];
    getDroppableId: DocumentListingDragAndDropConfig<TRow>['getDroppableId'];
    isItemRow: (row: TRow) => row is TItemRow;
    isFolderRow: (row: TRow) => row is TFolderRow;
    getMoveTarget: (item: TItem) => TMoveTarget;
    moveItem: (itemId: string, folderId: string | null) => Promise<unknown>;
    moveToast: PromiseToastOptions<unknown>;
    folderPermissions: FolderActionPermissions;
    getItemActions: (helpers: FolderedItemActionHelpers<TItemRow>) => Record<string, ActionConfig<TItemRow>>;
    mapItemMenuOptions?: (options: MenuOption[], payload: FolderedItemMenuPayload<TItemRow>) => MenuOption[];
    onOpenItem: (item: TItemRow) => void;
}

const useFolderedResourceListing = <
    TItem,
    TFolder extends FolderBreadcrumbEntity,
    TRow extends Identifiable,
    TItemRow extends TItem & TRow & FolderedMoveEntity,
    TFolderRow extends TRow,
    TMoveTarget extends FolderedMoveEntity
>({
    renameFolderModalId,
    moveModalId,
    canMoveItems,
    activationDistance,
    getDraggableId,
    getDroppableId,
    isItemRow,
    isFolderRow,
    getMoveTarget,
    moveItem,
    moveToast,
    folderPermissions,
    getItemActions,
    mapItemMenuOptions,
    onOpenItem,
    ...listingOptions
}: UseFolderedResourceListingOptions<TItem, TFolder, TRow, TItemRow, TFolderRow, TMoveTarget>) => {
    const listing = useFolderedListing<TItem, TFolder, TRow>(listingOptions);
    const [movingItem, setMovingItem] = useState<TMoveTarget | null>(null);

    const handleRenameFolderOpen = useCallback((folder: TFolder) => {
        listing.handleRenameFolderOpen(folder);
        openModal(renameFolderModalId);
    }, [listing, renameFolderModalId]);

    const handleRenameFolderClose = useCallback(() => {
        closeModal(renameFolderModalId);
        listing.handleRenameFolderClose();
    }, [listing, renameFolderModalId]);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        await listing.handleRenameFolderSubmit(title);
        closeModal(renameFolderModalId);
    }, [listing, renameFolderModalId]);

    const handleMoveOpen = useCallback((item: TItem) => {
        setMovingItem(getMoveTarget(item));
        openModal(moveModalId);
    }, [getMoveTarget, moveModalId]);

    const handleMoveClose = useCallback(() => {
        closeModal(moveModalId);
        setMovingItem(null);
    }, [moveModalId]);

    const handleMoveSubmit = useCallback(async (folderId: string | null) => {
        if (!movingItem) {
            return;
        }

        await showPromise(
            moveItem(movingItem._id, folderId),
            moveToast
        );
    }, [moveItem, moveToast, movingItem]);

    const handleDragEnd = useCallback(async (
        payload: Parameters<DocumentListingDragAndDropConfig<TRow>['onDragEnd']>[0]
    ) => {
        const { activeItem, overItem } = payload;
        if (!activeItem || !overItem || !isItemRow(activeItem) || !isFolderRow(overItem)) {
            return;
        }

        if (activeItem.folder === overItem._id) {
            return;
        }

        await showPromise(
            moveItem(activeItem._id, overItem._id),
            moveToast
        );
    }, [isFolderRow, isItemRow, moveItem, moveToast]);

    const dragAndDrop = useMemo<DocumentListingDragAndDropConfig<TRow> | undefined>(() => {
        if (!canMoveItems) {
            return undefined;
        }

        return {
            activationDistance,
            getDraggableId,
            getDroppableId,
            onDragEnd: handleDragEnd
        };
    }, [activationDistance, canMoveItems, getDraggableId, getDroppableId, handleDragEnd]);

    const { getMenuOptions: getFolderMenuOptions } = useListingActions<TFolderRow>({
        actions: {
            open: {
                label: 'Open Folder',
                icon: FolderOpen,
                handler: ({ item }) => listing.openFolder(item._id)
            },
            rename: {
                label: 'Rename Folder',
                icon: Pencil,
                handler: ({ item }) => handleRenameFolderOpen(item as unknown as TFolder),
                requiredPermission: folderPermissions.rename
            },
            delete: {
                label: 'Delete Folder',
                icon: Trash2,
                variant: 'danger',
                handler: async ({ item }) => {
                    await listing.handleDeleteFolder(item as unknown as TFolder);
                },
                requiredPermission: folderPermissions.delete
            }
        }
    });

    const itemActions = useMemo(() => {
        return getItemActions({ openMove: handleMoveOpen });
    }, [getItemActions, handleMoveOpen]);

    const { getMenuOptions: getItemMenuOptions } = useListingActions<TItemRow>({
        actions: itemActions
    });

    const getMenuOptions = useCallback((item: TRow, selectedItems: TRow[]): MenuOption[] => {
        if (isFolderRow(item)) {
            return getFolderMenuOptions(item, [item]);
        }

        if (!isItemRow(item)) {
            return [];
        }

        const itemSelection = selectedItems.filter(isItemRow);
        const options = getItemMenuOptions(item, itemSelection);

        return mapItemMenuOptions
            ? mapItemMenuOptions(options, { item, selectedItems: itemSelection })
            : options;
    }, [getFolderMenuOptions, getItemMenuOptions, isFolderRow, isItemRow, mapItemMenuOptions]);

    const handleItemClick = useCallback((item: TRow): boolean => {
        if (isFolderRow(item)) {
            listing.openFolder(item._id);
            return true;
        }

        if (!isItemRow(item)) {
            return false;
        }

        onOpenItem(item);
        return true;
    }, [isFolderRow, isItemRow, listing, onOpenItem]);

    return {
        ...listing,
        dragAndDrop,
        getMenuOptions,
        handleItemClick,
        handleMoveClose,
        handleMoveOpen,
        handleMoveSubmit,
        handleRenameFolderClose,
        handleRenameFolderOpen,
        handleRenameFolderSubmit,
        movingItem
    };
};

export default useFolderedResourceListing;
