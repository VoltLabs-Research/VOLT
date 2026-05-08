import { useCallback } from 'react';
import { closeModal, openModal } from '@/shared/presentation/primitives/Modal';

interface UseRenameFolderModalOptions<TFolder> {
    modalId: string;
    openRenameState: (folder: TFolder) => void;
    closeRenameState: () => void;
    submitRenameState: (title: string) => Promise<void>;
}

const useRenameFolderModal = <TFolder,>({
    modalId,
    openRenameState,
    closeRenameState,
    submitRenameState
}: UseRenameFolderModalOptions<TFolder>) => {
    const handleRenameFolderOpen = useCallback((folder: TFolder) => {
        openRenameState(folder);
        openModal(modalId);
    }, [modalId, openRenameState]);

    const handleRenameFolderClose = useCallback(() => {
        closeModal(modalId);
        closeRenameState();
    }, [closeRenameState, modalId]);

    const handleRenameFolderSubmit = useCallback(async (title: string) => {
        await submitRenameState(title);
        closeModal(modalId);
    }, [modalId, submitRenameState]);

    return {
        handleRenameFolderOpen,
        handleRenameFolderClose,
        handleRenameFolderSubmit
    };
};

export default useRenameFolderModal;
