import { Box, Modal, closeModal } from '@/shared/presentation/primitives';
import { useState, useEffect, useCallback, useRef } from 'react';
import ModalFooterActions from '@/shared/presentation/components/ModalFooterActions';
import type { KeyboardEvent } from 'react';
import './EditMessageModal.css';

interface EditMessageModalProps {
    messageId: string | null;
    initialContent: string;
    onSave: (messageId: string, newContent: string) => Promise<void>;
    onClose: () => void;
};

export const EDIT_MESSAGE_MODAL_ID = 'edit-message-modal';
const EDIT_MESSAGE_TEXTAREA_ID = 'edit-message-modal-textarea';

const EditMessageModal = ({ messageId, initialContent, onSave, onClose }: EditMessageModalProps) => {
    const [content, setContent] = useState(initialContent);
    const [isLoading, setIsLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const focusTextarea = () => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
    };

    useEffect(() => {
        setContent(initialContent);

        if (initialContent && textareaRef.current) {
            setTimeout(() => {
                focusTextarea();
            }, 100);
        }
    }, [initialContent]);

    const handleSave = useCallback(async () => {
        if (!messageId || !content.trim() || content === initialContent) {
            closeModal(EDIT_MESSAGE_MODAL_ID);
            onClose();
            return;
        }

        setIsLoading(true);
        try {
            await onSave(messageId, content.trim());
            closeModal(EDIT_MESSAGE_MODAL_ID);
            onClose();
        } finally {
            setIsLoading(false);
        }
    }, [messageId, content, initialContent, onSave, onClose]);

    const handleCancel = useCallback(() => {
        closeModal(EDIT_MESSAGE_MODAL_ID);
        onClose();
    }, [onClose]);

    const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    }, [handleSave, handleCancel]);

    return (
        <Modal
            id={EDIT_MESSAGE_MODAL_ID}
            title='Edit Message'
            width='400px'
            footer={
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onClick: handleCancel
                    }}
                    primary={{
                        label: 'Save',
                        onClick: handleSave,
                        isLoading: isLoading,
                        disabled: !content.trim() || content === initialContent
                    }}
                />
            }
        >
            <Box className='edit-message-modal-content'>
                <label htmlFor={EDIT_MESSAGE_TEXTAREA_ID} className='sr-only'>
                    Edit message
                </label>
                <textarea
                    ref={textareaRef}
                    id={EDIT_MESSAGE_TEXTAREA_ID}
                    className='edit-message-textarea w-max radius-sm'
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Enter your message...'
                    rows={3}
                />
            </Box>
        </Modal>
    );
};

export default EditMessageModal;
