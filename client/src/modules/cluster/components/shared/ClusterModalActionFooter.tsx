import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';

interface ClusterModalActionFooterProps {
    cancelLabel?: string;
    confirmLabel: string;
    confirmIntent?: 'danger';
    onCancel: () => void;
    onConfirm: () => void;
    isSubmitting?: boolean;
    confirmDisabled?: boolean;
}

const ClusterModalActionFooter = ({
    cancelLabel = 'Cancel',
    confirmLabel,
    confirmIntent,
    onCancel,
    onConfirm,
    isSubmitting = false,
    confirmDisabled = false
}: ClusterModalActionFooterProps) => (
    <ModalFooterActions
        secondary={{
            label: cancelLabel,
            onClick: onCancel,
            disabled: isSubmitting
        }}
        primary={{
            label: confirmLabel,
            intent: confirmIntent,
            onClick: onConfirm,
            isLoading: isSubmitting,
            disabled: confirmDisabled
        }}
    />
);

export default ClusterModalActionFooter;
