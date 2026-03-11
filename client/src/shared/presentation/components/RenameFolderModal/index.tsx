import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Container from '@/shared/presentation/components/Container';
import { useCallback, useEffect, useState } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

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
    const [nextFolderName, setNextFolderName] = useState('');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setNextFolderName(folderName ?? '');
        setError(undefined);
        setIsSubmitting(false);
    }, [folderName]);

    const handleClose = useCallback(() => {
        closeModal(id);
        setError(undefined);
        setIsSubmitting(false);
        onClose();
    }, [id, onClose]);

    const handleSubmit = useCallback(async () => {
        const trimmedFolderName = nextFolderName.trim();

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
    }, [handleClose, nextFolderName, onSubmit]);

    const handleFolderNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setNextFolderName(event.target.value);
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
        label: 'Rename Folder',
        onClick: handleSubmit,
        disabled: isSubmitting || !nextFolderName.trim(),
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
                    label='Folder name'
                    placeholder='Enter folder name'
                    autoFocus
                    value={nextFolderName}
                    onChange={handleFolderNameChange}
                    inputProps={inputProps}
                    error={error}
                />
            </Container>
        </Modal>
    );
};

export default RenameFolderModal;
