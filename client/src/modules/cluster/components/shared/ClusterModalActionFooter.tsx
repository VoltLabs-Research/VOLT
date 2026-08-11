import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';

interface ClusterModalActionFooterProps {
    cancelLabel?: string;
    confirmLabel: string;

    confirmVariant?: 'danger';
    onCancel: () => void;
    onConfirm: () => void;
    isSubmitting?: boolean;
    confirmDisabled?: boolean;
}

const ClusterModalActionFooter = ({
    cancelLabel = 'Cancel',
    confirmLabel,
    confirmVariant,
    onCancel,
    onConfirm,
    isSubmitting = false,
    confirmDisabled = false
}: ClusterModalActionFooterProps) => (
    <ModalFooterActions
        secondary={{
            label: cancelLabel,
            onPress: onCancel,
            isDisabled: isSubmitting
        }}
        primary={{
            label: confirmLabel,
            variant: confirmVariant,
            onPress: onConfirm,
            isPending: isSubmitting,
            isDisabled: confirmDisabled
        }}
    />
);

export default ClusterModalActionFooter;
