import { closeModal } from '@/shared/presentation/primitives/Modal';
import TextInputModal from '@/shared/presentation/components/RenameEntityModal/TextInputModal';
import useTextInputModalState from '@/shared/presentation/components/RenameEntityModal/use-text-input-modal-state';
import useMedia from '@/shared/presentation/hooks/use-media';
import { useCallback } from 'react';

interface NewFolderModalProps {
    id: string;
    title: string;
    description: string;
    fieldLabel?: string;
    placeholder?: string;
    submitLabel?: string;
    onSubmit: (title: string) => Promise<void>;
    onClose?: () => void;
};

const NewFolderModal = ({
    id,
    title,
    description,
    fieldLabel = 'Folder name',
    placeholder = 'Enter folder name',
    submitLabel = 'Create Folder',
    onSubmit,
    onClose
}: NewFolderModalProps) => {
    const shouldAutoFocus = !useMedia('(pointer: coarse)');

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
        submitErrorTitle: 'Failed to create folder',
        onSubmit,
        onSubmitted: handleRequestClose
    });

    const handleModalClose = useCallback(() => {
        reset();
        onClose?.();
    }, [onClose, reset]);

    return (
        <TextInputModal
            modalId={id}
            modalTitle={title}
            description={description}
            fieldLabel={fieldLabel}
            placeholder={placeholder}
            autoFocus={shouldAutoFocus}
            value={folderName}
            error={error}
            primaryLabel={submitLabel}
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

export default NewFolderModal;
