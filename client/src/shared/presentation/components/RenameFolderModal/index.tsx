import { ErrorSurface, reportError } from '@/shared/errors/core';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Box from '@/shared/presentation/primitives/Box';
import Modal, { closeModal } from '@/shared/presentation/primitives/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { useCallback, useEffect, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

interface RenameFolderModalProps {
    id: string;
    title: string;
    description: string;
    folderName: string | null;
    onSubmit: (title: string) => Promise<void>;
    onClose: () => void;
};

const COARSE_POINTER_MEDIA_QUERY = '(pointer: coarse)';

const shouldEnableModalAutofocus = () => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return true;
    }

    return !window.matchMedia(COARSE_POINTER_MEDIA_QUERY).matches;
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
    const shouldAutoFocus = shouldEnableModalAutofocus();

    useEffect(() => {
        setNextFolderName(folderName ?? '');
        setError(undefined);
        setIsSubmitting(false);
    }, [folderName]);

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const handleModalClose = useCallback(() => {
        setError(undefined);
        setIsSubmitting(false);
        onClose();
    }, [onClose]);

    const handleSubmit = useCallback(async () => {
        const trimmedFolderName = nextFolderName.trim();

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
                fallbackTitle: 'Failed to rename folder'
            });

            setError(userError.description ?? userError.title);
        } finally {
            setIsSubmitting(false);
        }
    }, [handleRequestClose, nextFolderName, onSubmit]);

    const handleFolderNameChange = useCallback((event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setNextFolderName(event.target.value);
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
            onClose={handleModalClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Box p='1-5'>
                <FormFieldRHF
                    label='Folder name'
                    placeholder='Enter folder name'
                    autoFocus={shouldAutoFocus}
                    value={nextFolderName}
                    onChange={handleFolderNameChange}
                    inputProps={inputProps}
                    error={error}
                />
            </Box>
        </Modal>
    );
};

export default RenameFolderModal;
