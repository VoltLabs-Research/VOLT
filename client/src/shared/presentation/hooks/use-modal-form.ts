import { openModal, resetModal } from '@/shared/presentation/components/Modal';
import { useCallback, useMemo } from 'react';

interface UseModalFormOptions {
    modalId: string;
    reset?: () => void;
    onAfterClose?: () => void;
    resetDelay?: number;
};

const useModalForm = ({
    modalId,
    reset,
    onAfterClose,
    resetDelay = 300
}: UseModalFormOptions) => {
    const close = useCallback(() => {
        resetModal(modalId, () => {
            reset?.();
            onAfterClose?.();
        }, resetDelay);
    }, [modalId, onAfterClose, reset, resetDelay]);

    const open = useCallback(() => {
        openModal(modalId);
    }, [modalId]);

    return useMemo(() => ({ close, open }), [close, open]);
};

export default useModalForm;
