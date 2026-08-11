import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import { Modal } from '@/shared/ui/modal/Modal';
import { closeModal, openModal } from '@/shared/ui/modal/use-modal-store';
import { ConfirmActionTone, registerConfirmActionController } from '@/shared/ui/hooks/use-confirm';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import type { ConfirmActionOptions } from '@/shared/ui/hooks/use-confirm';

interface ConfirmActionModalState extends ConfirmActionOptions {
    confirmText: string;
    cancelText: string;
    tone: ConfirmActionTone;
};

const CONFIRM_ACTION_MODAL_ID = 'shared-confirm-action-modal';

const CONFIRM_ACTION_MODAL_WIDTH = 'min(100%, 28rem)';

const ConfirmActionModal = () => {
    const [modalState, setModalState] = useState<ConfirmActionModalState | null>(null);
    const [typedText, setTypedText] = useState('');
    const resolverRef = useRef<((value: boolean) => void) | null>(null);
    const pendingResultRef = useRef(false);
    const typedConfirmationDescriptionId = useId();

    const resolvePendingRequest = useCallback((value: boolean) => {
        const resolver = resolverRef.current;
        resolverRef.current = null;

        if (resolver) {
            resolver(value);
        }
    }, []);

    const handleModalClose = useCallback(() => {
        const result = pendingResultRef.current;
        pendingResultRef.current = false;
        setModalState(null);
        setTypedText('');
        resolvePendingRequest(result);
    }, [resolvePendingRequest]);

    const handleCancel = useCallback(() => {
        pendingResultRef.current = false;
        closeModal(CONFIRM_ACTION_MODAL_ID);
    }, []);

    const handleConfirm = useCallback(() => {
        pendingResultRef.current = true;
        closeModal(CONFIRM_ACTION_MODAL_ID);
    }, []);

    useEffect(() => {
        return registerConfirmActionController({
            open: (options) => {
                resolvePendingRequest(false);
                pendingResultRef.current = false;
                setTypedText('');

                return new Promise((resolve) => {
                    resolverRef.current = resolve;
                    setModalState({
                        confirmText: options.confirmText ?? 'Confirm',
                        cancelText: options.cancelText ?? 'Cancel',
                        tone: options.tone ?? ConfirmActionTone.Default,
                        ...options
                    });
                    openModal(CONFIRM_ACTION_MODAL_ID);
                });
            }
        });
    }, [resolvePendingRequest]);

    const isTypedConfirmationValid = !modalState?.requireTypedText || typedText === modalState.requireTypedText;
    const confirmVariant = modalState?.tone === ConfirmActionTone.Danger ? 'danger' : 'primary';
    const typedConfirmationLabel = modalState?.requireTypedText
        ? `Type ${modalState.requireTypedText} to confirm`
        : '';
    const typedConfirmationDescription = modalState?.requireTypedText
        ? `This action requires an exact confirmation phrase: ${modalState.requireTypedText}`
        : '';

    const typedConfirmationInputProps: InputHTMLAttributes<HTMLInputElement> & {
        'data-modal-initial-focus'?: string;
    } = {
        'aria-describedby': typedConfirmationDescriptionId,
        'data-modal-initial-focus': 'true'
    };
    const footer = (
        <ModalFooterActions
            secondary={{
                label: modalState?.cancelText ?? 'Cancel',
                onPress: handleCancel
            }}
            primary={{
                label: modalState?.confirmText ?? 'Confirm',
                variant: confirmVariant,
                onPress: handleConfirm,
                isDisabled: !isTypedConfirmationValid
            }}
        />
    );

    return (
        <Modal
            id={CONFIRM_ACTION_MODAL_ID}
            title={modalState?.title}
            description={modalState?.description}
            width={CONFIRM_ACTION_MODAL_WIDTH}
            onClose={handleModalClose}
            footer={footer}
        >
            <div className='flex flex-col gap-4'>
                {modalState?.requireTypedText && (
                    <>
                        <p className='text-sm text-muted' id={typedConfirmationDescriptionId}>
                            {typedConfirmationDescription}
                        </p>
                        <FormFieldRHF
                            label={typedConfirmationLabel}
                            value={typedText}
                            onChange={(event) => setTypedText(event.target.value)}
                            inputProps={typedConfirmationInputProps}
                        />
                    </>
                )}
            </div>
        </Modal>
    );
};

export default ConfirmActionModal;
