import React from 'react';
import Button from '@/shared/presentation/components/Button';

interface ModalFooterProps {
    onCancel: () => void;
    onSubmit?: () => void;
    cancelLabel?: string;
    submitLabel?: string;
    isSubmitting?: boolean;
    isSubmitDisabled?: boolean;
    showSubmit?: boolean;
};

const ModalFooter: React.FC<ModalFooterProps> = ({
    onCancel,
    onSubmit,
    cancelLabel = 'Cancel',
    submitLabel = 'Save',
    isSubmitting = false,
    isSubmitDisabled = false,
    showSubmit = true
}) => {
    return (
        <>
            <Button
                variant='ghost'
                intent='neutral'
                onClick={onCancel}
                disabled={isSubmitting}
            >
                {cancelLabel}
            </Button>
            {showSubmit && onSubmit && (
                <Button
                    variant='solid'
                    intent='brand'
                    onClick={onSubmit}
                    disabled={isSubmitting || isSubmitDisabled}
                    isLoading={isSubmitting}
                >
                    {submitLabel}
                </Button>
            )}
        </>
    );
};

export default ModalFooter;
