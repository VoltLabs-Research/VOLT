import Modal, { closeModal } from '@/shared/presentation/primitives/Modal';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Box from '@/shared/presentation/primitives/Box';
import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

interface RenameEntityModalProps<TEntity> {
    entity: TEntity | null;
    modalId: string;
    title: string;
    description: string;
    fieldLabel: string;
    placeholder: string;
    getInitialTitle: (entity: TEntity) => string;
    validateTitle?: (title: string) => string | undefined;
    onSubmit: (title: string) => Promise<void>;
    onClose: () => void;
};

const RenameEntityModal = <TEntity,>({
    entity,
    modalId,
    title: modalTitle,
    description,
    fieldLabel,
    placeholder,
    getInitialTitle,
    validateTitle,
    onSubmit,
    onClose
}: RenameEntityModalProps<TEntity>) => {
    const [title, setTitle] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | undefined>();

    useEffect(() => {
        if (!entity) {
            return;
        }

        setTitle(getInitialTitle(entity));
        setError(undefined);
    }, [entity, getInitialTitle]);

    const handleClose = useCallback(() => {
        closeModal(modalId);
        onClose();
    }, [modalId, onClose]);

    const handleSubmit = useCallback(async () => {
        const trimmed = title.trim();
        if (!trimmed) {
            setError('Title is required');
            return;
        }

        const validationError = validateTitle?.(trimmed);
        if (validationError) {
            setError(validationError);
            return;
        }

        setIsSubmitting(true);
        try {
            await onSubmit(trimmed);
        } finally {
            setIsSubmitting(false);
        }
    }, [onSubmit, title, validateTitle]);

    const handleTitleChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setTitle(event.target.value);
        setError(undefined);
    }, []);

    const inputProps: InputHTMLAttributes<HTMLInputElement> = {
        onKeyDown: (event) => {
            if (event.key === 'Enter') {
                handleSubmit();
            }
        }
    };

    const primaryAction: ModalFooterAction = {
        label: 'Rename',
        onClick: handleSubmit,
        disabled: isSubmitting || !title.trim()
    };

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: handleClose,
        disabled: isSubmitting
    };

    return (
        <Modal
            id={modalId}
            title={modalTitle}
            description={description}
            onClose={handleClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Box p='1-5'>
                <FormFieldRHF
                    label={fieldLabel}
                    placeholder={placeholder}
                    autoFocus
                    value={title}
                    onChange={handleTitleChange}
                    inputProps={inputProps}
                    error={error}
                />
            </Box>
        </Modal>
    );
};

export default RenameEntityModal;
