import { ErrorSurface, reportError } from '@/shared/errors/core';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Box from '@/shared/presentation/primitives/Box';
import Modal, { closeModal } from '@/shared/presentation/primitives/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { useCallback, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
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

const COARSE_POINTER_MEDIA_QUERY = '(pointer: coarse)';

const shouldEnableModalAutofocus = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return true;
    }

    return !window.matchMedia(COARSE_POINTER_MEDIA_QUERY).matches;
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
    const shouldAutoFocus = shouldEnableModalAutofocus();

    const resetState = useCallback(() => {
        setFolderName('');
        setError(undefined);
        setIsSubmitting(false);
    }, []);

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const handleModalClose = useCallback(() => {
        resetState();
        onClose?.();
    }, [onClose, resetState]);

    const handleSubmit = useCallback(async () => {
        const trimmedFolderName = folderName.trim();

        if (!trimmedFolderName) {
            setError('Folder name is required');
            return;
        }

        setIsSubmitting(true);
        setError(undefined);

        try {
            await onSubmit(trimmedFolderName);
            handleRequestClose();
        } catch (nextError) {
            const userError = reportError(nextError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Failed to create folder'
            });

            setError(userError.description ?? userError.title);
        } finally {
            setIsSubmitting(false);
        }
    }, [folderName, handleRequestClose, onSubmit]);

    const handleFolderNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFolderName(event.target.value);
        setError(undefined);
    }, []);

    const inputProps: InputHTMLAttributes<HTMLInputElement> = {
        onKeyDown: (event) => {
            if (event.key === 'Enter') {
                handleSubmit();
            }
        }
    };

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleRequestClose,
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
            onClose={handleModalClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Box p='1-5'>
                <FormFieldRHF
                    label={fieldLabel}
                    placeholder={placeholder}
                    autoFocus={shouldAutoFocus}
                    value={folderName}
                    onChange={handleFolderNameChange}
                    inputProps={inputProps}
                    error={error}
                />
            </Box>
        </Modal>
    );
};

export default NewFolderModal;
