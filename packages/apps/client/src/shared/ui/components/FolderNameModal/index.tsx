import { closeModal } from '@/shared/ui/modal/use-modal-store';
import TextInputModal from '@/shared/ui/components/RenameEntityModal/TextInputModal';
import useTextInputModalState from './use-text-input-modal-state';
import { useMedia } from '@/shared/ui/hooks/use-media';
import { useCallback, useEffect } from 'react';

interface FolderNameModalProps {
    id: string;
    title: string;
    description: string;
    initialName?: string | null;
    onSubmit: (title: string) => Promise<void>;
    onClose?: () => void;
};

const FolderNameModal = ({
    id,
    title,
    description,
    initialName,
    onSubmit,
    onClose
}: FolderNameModalProps) => {
    const shouldAutoFocus = !useMedia('(pointer: coarse)');
    const isRename = initialName !== undefined;
    const initialValue = initialName ?? '';

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const {
        value: folderName,
        error,
        isSubmitting,
        handleValueChange: handleFolderNameChange,
        handleSubmit,
        reset
    } = useTextInputModalState({
        requiredMessage: 'Folder name is required',
        submitErrorTitle: isRename ? 'Failed to rename folder' : 'Failed to create folder',
        onSubmit,
        onSubmitted: handleRequestClose
    });

    useEffect(() => {
        reset(initialValue);
    }, [initialValue, reset]);

    const handleModalClose = useCallback(() => {
        reset(initialValue);
        onClose?.();
    }, [initialValue, onClose, reset]);

    return (
        <TextInputModal
            modalId={id}
            modalTitle={title}
            description={description}
            fieldLabel='Folder name'
            placeholder='Enter folder name'
            autoFocus={shouldAutoFocus}
            value={folderName}
            error={error}
            primaryLabel={isRename ? 'Rename Folder' : 'Create Folder'}
            submitDisabled={isSubmitting || !folderName.trim()}
            isSubmitting={isSubmitting}
            primaryIsLoading={isSubmitting}
            onValueChange={handleFolderNameChange}
            onSubmit={handleSubmit}
            onCancel={handleRequestClose}
            onClose={handleModalClose}
        />
    );
};

export default FolderNameModal;
