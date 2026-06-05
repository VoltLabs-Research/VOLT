import { showPromise } from '@/shared/presentation/hooks/toast';
import { closeModal, openModal } from '@/shared/presentation/primitives/Modal';
import type { PromiseToastOptions } from '@/shared/presentation/utilities/toast-options';
import { useCallback, useState } from 'react';

interface UseRenameEntityModalOptions<TEntity, TUpdateParams, TResult> {
    modalId: string;
    updateEntity: (params: TUpdateParams) => Promise<TResult>;
    getUpdateParams: (entity: TEntity, title: string) => TUpdateParams;
    renameToast: PromiseToastOptions<TResult>;
}

const useRenameEntityModal = <TEntity, TUpdateParams, TResult = unknown>({
    modalId,
    updateEntity,
    getUpdateParams,
    renameToast
}: UseRenameEntityModalOptions<TEntity, TUpdateParams, TResult>) => {
    const [renamingEntity, setRenamingEntity] = useState<TEntity | null>(null);

    const handleRenameOpen = useCallback((entity: TEntity) => {
        setRenamingEntity(entity);
        openModal(modalId);
    }, [modalId]);

    const handleRenameClose = useCallback(() => {
        closeModal(modalId);
        setRenamingEntity(null);
    }, [modalId]);

    const handleRenameSubmit = useCallback(async (title: string) => {
        if (!renamingEntity) {
            return;
        }

        await showPromise(
            updateEntity(getUpdateParams(renamingEntity, title)),
            renameToast
        );

        handleRenameClose();
    }, [getUpdateParams, handleRenameClose, renameToast, renamingEntity, updateEntity]);

    return {
        renamingEntity,
        handleRenameOpen,
        handleRenameClose,
        handleRenameSubmit
    };
};

export default useRenameEntityModal;
