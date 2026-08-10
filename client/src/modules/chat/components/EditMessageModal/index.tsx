import { Modal, closeModal } from '@/shared/ui/modal';
import { useState, useEffect, useRef } from 'react';
import ModalFooterActions from '@/shared/ui/components/ModalFooterActions';
import type { KeyboardEvent } from 'react';

interface EditMessageModalProps {
    messageId: string | null;
    initialContent: string;
    onSave: (messageId: string, newContent: string) => Promise<unknown>;
    onClose: () => void;
}

export const EDIT_MESSAGE_MODAL_ID = 'edit-message-modal';
const EDIT_MESSAGE_TEXTAREA_ID = 'edit-message-modal-textarea';

/*
 * A plain `<textarea>` rather than HeroUI's `TextField` + `TextArea`: the field is
 * unlabelled on purpose (the modal's own title is the label, via the sr-only one
 * below), it is focused and selected imperatively through a ref on open, and
 * Enter-to-save / Escape-to-cancel are its own key handling. `[font-family:inherit]`
 * is what keeps a textarea from falling back to the UA's monospace stack.
 */
const TEXTAREA_CLASS_NAMES = 'w-full p-3 rounded-lg border border-border bg-surface-tertiary text-foreground text-sm [font-family:inherit] resize-y min-h-[80px] focus:outline-none focus:border-accent';

const EditMessageModal = ({ messageId, initialContent, onSave, onClose }: EditMessageModalProps) => {
    const [content, setContent] = useState(initialContent);
    const [isLoading, setIsLoading] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setContent(initialContent);

        if (initialContent && textareaRef.current) {
            setTimeout(() => {
                textareaRef.current?.focus();
                textareaRef.current?.select();
            }, 100);
        }
    }, [initialContent]);

    const handleCancel = () => {
        closeModal(EDIT_MESSAGE_MODAL_ID);
        onClose();
    };

    const handleSave = async () => {
        if (!messageId || !content.trim() || content === initialContent) {
            handleCancel();
            return;
        }

        setIsLoading(true);
        try {
            await onSave(messageId, content.trim());
            handleCancel();
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            handleCancel();
        }
    };

    return (
        <Modal
            id={EDIT_MESSAGE_MODAL_ID}
            title='Edit Message'
            width='400px'
            footer={
                <ModalFooterActions
                    secondary={{
                        label: 'Cancel',
                        onPress: handleCancel
                    }}
                    primary={{
                        label: 'Save',
                        onPress: handleSave,
                        isPending: isLoading,
                        isDisabled: !content.trim() || content === initialContent
                    }}
                />
            }
        >
            <div>
                <label htmlFor={EDIT_MESSAGE_TEXTAREA_ID} className='sr-only'>
                    Edit message
                </label>
                <textarea
                    ref={textareaRef}
                    id={EDIT_MESSAGE_TEXTAREA_ID}
                    className={TEXTAREA_CLASS_NAMES}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder='Enter your message...'
                    rows={3}
                />
            </div>
        </Modal>
    );
};

export default EditMessageModal;
