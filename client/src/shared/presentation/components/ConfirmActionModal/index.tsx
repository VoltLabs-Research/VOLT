import Container from '@/shared/presentation/components/Container';
import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import Modal, { closeModal, openModal } from '@/shared/presentation/components/Modal';
import Paragraph from '@/shared/presentation/components/Paragraph';
import { ConfirmActionTone, registerConfirmActionController } from '@/shared/presentation/hooks/use-confirm';
import './ConfirmActionModal.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConfirmActionOptions } from '@/shared/presentation/hooks/use-confirm';

interface ConfirmActionModalState extends ConfirmActionOptions {
    confirmText: string;
    cancelText: string;
    tone: ConfirmActionTone;
};

const CONFIRM_ACTION_MODAL_ID = 'shared-confirm-action-modal';

const ConfirmActionModal = () => {
    const [modalState, setModalState] = useState<ConfirmActionModalState | null>(null);
    const [typedText, setTypedText] = useState('');
    const resolverRef = useRef<((value: boolean) => void) | null>(null);
    const pendingResultRef = useRef(false);

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
    const confirmIntent = modalState?.tone === ConfirmActionTone.Danger ? 'danger' : 'brand';
    const typedConfirmationLabel = modalState?.requireTypedText
        ? `Type ${modalState.requireTypedText} to confirm`
        : '';
    const typedConfirmationDescription = modalState?.requireTypedText
        ? `This action requires an exact confirmation phrase: ${modalState.requireTypedText}`
        : '';
    const footer = (
        <ModalFooterActions
            secondary={{
                label: modalState?.cancelText ?? 'Cancel',
                onClick: handleCancel
            }}
            primary={{
                label: modalState?.confirmText ?? 'Confirm',
                intent: confirmIntent,
                onClick: handleConfirm,
                disabled: !isTypedConfirmationValid
            }}
        />
    );

    return (
        <Modal
            id={CONFIRM_ACTION_MODAL_ID}
            title={modalState?.title}
            description={modalState?.description}
            className='confirm-action-modal'
            onClose={handleModalClose}
            footer={footer}
        >
            <Container className='d-flex column gap-1'>
                {modalState?.requireTypedText && (
                    <>
                        <Paragraph className='font-size-2 color-secondary'>
                            {typedConfirmationDescription}
                        </Paragraph>
                        <FormFieldRHF
                            label={typedConfirmationLabel}
                            value={typedText}
                            onChange={(event) => setTypedText(event.target.value)}
                        />
                    </>
                )}
            </Container>
        </Modal>
    );
};

export default ConfirmActionModal;
