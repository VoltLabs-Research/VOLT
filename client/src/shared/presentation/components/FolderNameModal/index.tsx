import { closeModal } from '@voltstack/bravais';
import TextInputModal from '@/shared/presentation/components/RenameEntityModal/TextInputModal';
import useTextInputModalState from '@/shared/presentation/components/RenameEntityModal/use-text-input-modal-state';
import { useMedia } from '@voltstack/bravais';
import { useCallback, useEffect } from 'react';

interface FolderNameModalProps {
    id: string;
    title: string;
    description: string;
    // When provided (rename), the field is seeded/reset from it; omit for create.
    initialName?: string | null;
    fieldLabel?: string;
    placeholder?: string;
    submitLabel?: string;
    onSubmit: (title: string) => Promise<void>;
    onClose?: () => void;
};

const FolderNameModal = ({
    id,
    title,
    description,
    initialName,
    fieldLabel = 'Folder name',
    placeholder = 'Enter folder name',
    submitLabel,
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
            fieldLabel={fieldLabel}
            placeholder={placeholder}
            autoFocus={shouldAutoFocus}
            value={folderName}
            error={error}
            primaryLabel={submitLabel ?? (isRename ? 'Rename Folder' : 'Create Folder')}
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
