import { ErrorSurface, reportError } from '@/shared/errors/core';
import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { useCallback, useEffect, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

interface LammpsTextPromptModalProps {
    id: string;
    title: string;
    description: string;
    fieldLabel: string;
    placeholder: string;
    submitLabel: string;
    value?: string | null;
    onSubmit: (value: string) => Promise<void>;
    onClose?: () => void;
}

const LammpsTextPromptModal = ({
    id,
    title,
    description,
    fieldLabel,
    placeholder,
    submitLabel,
    value = '',
    onSubmit,
    onClose
}: LammpsTextPromptModalProps) => {
    const [currentValue, setCurrentValue] = useState(value ?? '');
    const [error, setError] = useState<string | undefined>();
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        setCurrentValue(value ?? '');
    }, [value]);

    const handleRequestClose = useCallback(() => {
        closeModal(id);
    }, [id]);

    const handleModalClose = useCallback(() => {
        setCurrentValue(value ?? '');
        setError(undefined);
        setIsSubmitting(false);
        onClose?.();
    }, [onClose, value]);

    const handleSubmit = useCallback(async () => {
        const nextValue = currentValue.trim();
        if (!nextValue) {
            setError('This field is required.');
            return;
        }

        setIsSubmitting(true);
        setError(undefined);

        try {
            await onSubmit(nextValue);
            handleRequestClose();
        } catch (nextError) {
            const userError = reportError(nextError, {
                surface: ErrorSurface.Silent,
                fallbackTitle: 'Request failed'
            });
            setError(userError.description ?? userError.title);
        } finally {
            setIsSubmitting(false);
        }
    }, [currentValue, handleRequestClose, onSubmit]);

    const inputProps: InputHTMLAttributes<HTMLInputElement> = {
        onKeyDown: (event) => {
            if (event.key === 'Enter') {
                void handleSubmit();
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
        onClick: () => {
            void handleSubmit();
        },
        disabled: isSubmitting || !currentValue.trim(),
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
            <Container className='p-1-5'>
                <FormFieldRHF
                    label={fieldLabel}
                    placeholder={placeholder}
                    value={currentValue}
                    onChange={(event) => {
                        setCurrentValue(event.target.value);
                        setError(undefined);
                    }}
                    error={error}
                    inputProps={inputProps}
                />
            </Container>
        </Modal>
    );
};

export default LammpsTextPromptModal;
