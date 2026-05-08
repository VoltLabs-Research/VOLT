import type { DocumentListingDragAndDropConfig } from '@/shared/presentation/components/DocumentListing/drag-and-drop';
import type { Identifiable } from '@/shared/presentation/components/DocumentListingTable';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { PromiseToastOptions } from '@/shared/presentation/toast-options';
import { useCallback, useMemo } from 'react';

interface FolderedMoveItemRow extends Identifiable {
    folder: string | null;
}

interface UseFolderedListingDragAndDropMoveOptions<
    TRow extends Identifiable,
    TItemRow extends TRow & FolderedMoveItemRow,
    TFolderRow extends TRow & Identifiable
> {
    canMove: boolean;
    activationDistance: number;
    getDraggableId: DocumentListingDragAndDropConfig<TRow>['getDraggableId'];
    getDroppableId: DocumentListingDragAndDropConfig<TRow>['getDroppableId'];
    isItemRow: (row: TRow) => row is TItemRow;
    isFolderRow: (row: TRow) => row is TFolderRow;
    moveItem: (itemId: string, folderId: string | null) => Promise<unknown>;
    moveToast: PromiseToastOptions<unknown>;
}

const useFolderedListingDragAndDropMove = <
    TRow extends Identifiable,
    TItemRow extends TRow & FolderedMoveItemRow,
    TFolderRow extends TRow & Identifiable
>({
    canMove,
    activationDistance,
    getDraggableId,
    getDroppableId,
    isItemRow,
    isFolderRow,
    moveItem,
    moveToast
}: UseFolderedListingDragAndDropMoveOptions<TRow, TItemRow, TFolderRow>): DocumentListingDragAndDropConfig<TRow> | undefined => {
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

    return useMemo<DocumentListingDragAndDropConfig<TRow> | undefined>(() => {
        if (!canMove) {
            return undefined;
        }

        return {
            activationDistance,
            getDraggableId,
            getDroppableId,
            onDragEnd: handleDragEnd
        };
    }, [activationDistance, canMove, getDraggableId, getDroppableId, handleDragEnd]);
};

export default useFolderedListingDragAndDropMove;
