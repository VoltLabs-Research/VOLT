import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import Modal from '@/shared/presentation/primitives/Modal';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Box from '@/shared/presentation/primitives/Box';
import { useCallback } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';
import type { ModalFooterAction } from '@/shared/presentation/components/ModalFooterActions';

interface TextInputModalProps {
    modalId: string;
    modalTitle: string;
    description: string;
    fieldLabel: string;
    placeholder: string;
    value: string;
    error?: string;
    autoFocus?: boolean;
    primaryLabel: string;
    submitDisabled: boolean;
    isSubmitting: boolean;
    primaryIsLoading?: boolean;
    onValueChange: (value: string) => void;
    onSubmit: () => void | Promise<void>;
    onCancel: () => void;
    onClose: () => void;
};

const TextInputModal = ({
    modalId,
    modalTitle,
    description,
    fieldLabel,
    placeholder,
    value,
    error,
    autoFocus = false,
    primaryLabel,
    submitDisabled,
    isSubmitting,
    primaryIsLoading,
    onValueChange,
    onSubmit,
    onCancel,
    onClose
}: TextInputModalProps) => {
    const handleValueChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        onValueChange(event.target.value);
    }, [onValueChange]);

    const inputProps: InputHTMLAttributes<HTMLInputElement> = {
        onKeyDown: (event) => {
            if (event.key === 'Enter') {
                onSubmit();
            }
        }
    };

    const secondaryAction: ModalFooterAction = {
        label: 'Cancel',
        onClick: onCancel,
        disabled: isSubmitting
    };

    const primaryAction: ModalFooterAction = {
        label: primaryLabel,
        onClick: onSubmit,
        disabled: submitDisabled,
        ...(primaryIsLoading === undefined ? {} : { isLoading: primaryIsLoading })
    };

    return (
        <Modal
            id={modalId}
            title={modalTitle}
            description={description}
            onClose={onClose}
            footer={<ModalFooterActions primary={primaryAction} secondary={secondaryAction} />}
        >
            <Box p='1-5'>
                <FormFieldRHF
                    label={fieldLabel}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    value={value}
                    onChange={handleValueChange}
                    inputProps={inputProps}
                    error={error}
                />
            </Box>
        </Modal>
    );
};

export default TextInputModal;
