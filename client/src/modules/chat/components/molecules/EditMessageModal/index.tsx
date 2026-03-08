import { useState, useEffect, useCallback, useRef } from 'react';
import Modal, { openModal, closeModal } from '@/shared/presentation/components/Modal';
import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import './EditMessageModal.css';

const MODAL_ID = 'edit-message-modal';

interface EditMessageModalProps {
    messageId: string | null;
    initialContent: string;
    onSave: (messageId: string, newContent: string) => Promise<void>;
    onClose: () => void;
};

const EditMessageModal = ({ messageId, initialContent, onSave, onClose }: EditMessageModalProps) => {
    const [content, setContent] = useState(initialContent);
    const [isLoading, setIsLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setContent(initialContent);
        // Focus and select text when modal opens
        if (initialContent && textareaRef.current) {
            setTimeout(() => {
                textareaRef.current?.focus();
                textareaRef.current?.select();
            }, 100);
        }
    }, [initialContent]);

    const handleSave = useCallback(async () => {
        if (!messageId || !content.trim() || content === initialContent) {
            closeModal(MODAL_ID);
            onClose();
            return;
        }

        setIsLoading(true);
        try {
            await onSave(messageId, content.trim());
            closeModal(MODAL_ID);
            onClose();
        } finally {
            setIsLoading(false);
        }
    }, [messageId, content, initialContent, onSave, onClose]);

    const handleCancel = useCallback(() => {
        closeModal(MODAL_ID);
        onClose();
    }, [onClose]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    }, [handleSave, handleCancel]);

    return (
        <Modal
            id={MODAL_ID}
            title='Edit Message'
            width='400px'
            footer={
                <>
                    <Button variant='ghost' onClick={handleCancel}>
                        Cancel
                    </Button>
                    <Button
                        variant='solid'
                        intent='brand'
                        onClick={handleSave}
                        isLoading={isLoading}
                        disabled={!content.trim() || content === initialContent}
                    >
                        Save
                    </Button>
                </>
            }
        >
            <Container className='edit-message-modal-content'>
                <textarea
                    ref={textareaRef}
                    className='edit-message-textarea w-max radius-sm'
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Enter your message...'
                    rows={3}
                />
            </Container>
        </Modal>
    );
};

export default EditMessageModal;

export { MODAL_ID as EDIT_MESSAGE_MODAL_ID, openModal, closeModal };
