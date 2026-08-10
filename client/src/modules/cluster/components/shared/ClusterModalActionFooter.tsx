import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';

interface ClusterModalActionFooterProps {
    cancelLabel?: string;
    confirmLabel: string;
    /**
     * Was `confirmIntent`. HeroUI crosses no intent axis — bravais's
     * `intent='danger'` is HeroUI's `variant='danger'` — and `ModalFooterActions`
     * now types its actions on HeroUI's own `ButtonProps`, so the prop is named
     * after what it sets. No caller passes it, so the rename costs nothing.
     */
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
