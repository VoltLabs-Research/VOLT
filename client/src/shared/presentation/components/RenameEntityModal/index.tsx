import { closeModal } from '@/shared/presentation/primitives/Modal';
import TextInputModal from '@/shared/presentation/components/RenameEntityModal/TextInputModal';
import { useCallback, useEffect, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

interface RenameEntityModalProps<TEntity> {
    entity: TEntity | null;
    modalId: string;
    title: string;
    description: string;
    fieldLabel: string;
    placeholder: string;
    getInitialTitle: (entity: TEntity) => string;
    validateTitle?: (title: string) => string | undefined;
    isSubmitDisabled?: (title: string, entity: TEntity | null) => boolean;
    inputProps?: InputHTMLAttributes<HTMLInputElement>;
    leadingContent?: ReactNode;
    helperText?: ReactNode;
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
    isSubmitDisabled,
    inputProps,
    leadingContent,
    helperText,
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

    const handleTitleChange = useCallback((nextTitle: string) => {
        setTitle(nextTitle);
        setError(undefined);
    }, []);

    const trimmedTitle = title.trim();

    return (
        <TextInputModal
            modalId={modalId}
            modalTitle={modalTitle}
            description={description}
            fieldLabel={fieldLabel}
            placeholder={placeholder}
            autoFocus
            value={title}
            error={error}
            primaryLabel='Rename'
            submitDisabled={isSubmitting || !trimmedTitle || Boolean(isSubmitDisabled?.(trimmedTitle, entity))}
            isSubmitting={isSubmitting}
            inputProps={inputProps}
            leadingContent={leadingContent}
            helperText={helperText}
            onValueChange={handleTitleChange}
            onSubmit={handleSubmit}
            onCancel={handleClose}
            onClose={handleClose}
        />
    );
};

export default RenameEntityModal;
