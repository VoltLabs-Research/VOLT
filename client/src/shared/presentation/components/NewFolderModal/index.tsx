import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Container from '@/shared/presentation/components/Container';
import { useCallback, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

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
    const [folderName, setFolderName] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const resetState = useCallback(() => {
        setFolderName('');
        setError(undefined);
        setIsSubmitting(false);
    }, []);

    const handleClose = useCallback(() => {
        closeModal(id);
        resetState();
        onClose?.();
    }, [id, onClose, resetState]);

    const handleSubmit = useCallback(async () => {
        const trimmedFolderName = folderName.trim();

        if (!trimmedFolderName) {
            setError('Folder name is required');
            return;
        }

        setIsSubmitting(true);

        try {
            await onSubmit(trimmedFolderName);
            handleClose();
        } finally {
            setIsSubmitting(false);
        }
    }, [folderName, handleClose, onSubmit]);

    const handleFolderNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFolderName(event.target.value);
        setError(undefined);
    }, []);

    const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
        onKeyDown: (event) => {
            if (event.key === 'Enter') {
                handleSubmit();
            }
        }
    };

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleClose,
        disabled: isSubmitting
    };

    const primaryAction: ModalFooterAction = {
        label: submitLabel,
        onClick: handleSubmit,
        disabled: isSubmitting || !folderName.trim(),
        isLoading: isSubmitting
    };

    return (
        <Modal
            id={id}
            title={title}
            description={description}
            onClose={handleClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Container className='p-1-5'>
                <FormFieldRHF
                    label={fieldLabel}
                    placeholder={placeholder}
                    autoFocus
                    value={folderName}
                    onChange={handleFolderNameChange}
                    inputProps={inputProps}
                    error={error}
                />
            </Container>
        </Modal>
    );
};

export default NewFolderModal;
