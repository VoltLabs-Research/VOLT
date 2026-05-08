import type { Identifiable } from '@/shared/presentation/components/DocumentListingTable';
import { closeModal, openModal } from '@/shared/presentation/primitives/Modal';
import { showPromise } from '@/shared/presentation/hooks/toast';
import type { PromiseToastOptions } from '@/shared/presentation/toast-options';
import { useCallback, useState } from 'react';

interface UseFolderedListingMoveModalOptions<TItem, TMoveTarget extends Identifiable> {
    modalId: string;
    getMoveTarget: (item: TItem) => TMoveTarget;
    moveItem: (itemId: string, folderId: string | null) => Promise<unknown>;
    moveToast: PromiseToastOptions<unknown>;
}

const useFolderedListingMoveModal = <TItem, TMoveTarget extends Identifiable>({
    modalId,
    getMoveTarget,
    moveItem,
    moveToast
}: UseFolderedListingMoveModalOptions<TItem, TMoveTarget>) => {
    const [movingItem, setMovingItem] = useState<TMoveTarget | null>(null);

    const handleMoveOpen = useCallback((item: TItem) => {
        setMovingItem(getMoveTarget(item));
        openModal(modalId);
    }, [getMoveTarget, modalId]);

    const handleMoveClose = useCallback(() => {
        closeModal(modalId);
        setMovingItem(null);
    }, [modalId]);

    const handleMoveSubmit = useCallback(async (folderId: string | null) => {
        if (!movingItem) {
            return;
        }

        await showPromise(
            moveItem(movingItem._id, folderId),
            moveToast
        );
    }, [moveItem, moveToast, movingItem]);

    return {
        movingItem,
        handleMoveOpen,
        handleMoveClose,
        handleMoveSubmit
    };
};

export default useFolderedListingMoveModal;
