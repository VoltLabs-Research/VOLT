import { closeModal } from '@/shared/presentation/primitives/Modal';
import TextInputModal from '@/shared/presentation/components/RenameEntityModal/TextInputModal';
import useTextInputModalState from '@/shared/presentation/components/RenameEntityModal/use-text-input-modal-state';
import useMedia from '@/shared/presentation/hooks/use-media';
import { useCallback, useEffect } from 'react';

interface RenameFolderModalProps {
    id: string;
    title: string;
    description: string;
    folderName: string | null;
    onSubmit: (title: string) => Promise<void>;
    onClose: () => void;
};

const RenameFolderModal = ({
    id,
    title,
    description,
    folderName,
    onSubmit,
    onClose
}: RenameFolderModalProps) => {
    const shouldAutoFocus = !useMedia('(pointer: coarse)');

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const {
        value: nextFolderName,
        error,
        isSubmitting,
        handleValueChange: handleFolderNameChange,
        handleSubmit,
        reset
    } = useTextInputModalState({
        requiredMessage: 'Folder name is required',
        submitErrorTitle: 'Failed to rename folder',
        onSubmit,
        onSubmitted: handleRequestClose
    });

    useEffect(() => {
        reset(folderName ?? '');
    }, [folderName, reset]);

    const handleModalClose = useCallback(() => {
        reset(folderName ?? '');
        onClose();
    }, [folderName, onClose, reset]);

    return (
        <TextInputModal
            modalId={id}
            modalTitle={title}
            description={description}
            fieldLabel='Folder name'
            placeholder='Enter folder name'
            autoFocus={shouldAutoFocus}
            value={nextFolderName}
            error={error}
            primaryLabel='Rename Folder'
            submitDisabled={isSubmitting || !nextFolderName.trim()}
            isSubmitting={isSubmitting}
            primaryIsLoading={isSubmitting}
            onValueChange={handleFolderNameChange}
            onSubmit={handleSubmit}
            onCancel={handleRequestClose}
            onClose={handleModalClose}
        />
    );
};

export default RenameFolderModal;
