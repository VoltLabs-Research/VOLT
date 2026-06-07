import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import { Modal, Box } from '@voltstack/bravais';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import { useCallback } from 'react';
import type { ChangeEvent, InputHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
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
    inputProps?: InputHTMLAttributes<HTMLInputElement>;
    leadingContent?: ReactNode;
    helperText?: ReactNode;
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
    inputProps,
    leadingContent,
    helperText,
    onValueChange,
    onSubmit,
    onCancel,
    onClose
}: TextInputModalProps) => {
    const handleValueChange = useCallback((event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        onValueChange(event.target.value);
    }, [onValueChange]);

    const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
        inputProps?.onKeyDown?.(event);
        if (event.defaultPrevented || event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        onSubmit();
    }, [inputProps, onSubmit]);

    const mergedInputProps: InputHTMLAttributes<HTMLInputElement> = {
        ...inputProps,
        onKeyDown: handleKeyDown
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
                {leadingContent}
                <FormFieldRHF
                    label={fieldLabel}
                    placeholder={placeholder}
                    autoFocus={autoFocus}
                    value={value}
                    onChange={handleValueChange}
                    inputProps={mergedInputProps}
                    error={error}
                />
                {helperText}
            </Box>
        </Modal>
    );
};

export default TextInputModal;
