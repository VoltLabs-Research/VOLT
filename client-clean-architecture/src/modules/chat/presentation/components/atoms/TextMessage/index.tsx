import { useState } from 'react';
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import type { Message } from '@/modules/chat/domain/entities/Chat';
import Button from '@/shared/presentation/components/primitives/Button';
import '@/modules/chat/presentation/components/atoms/TextMessage/TextMessage.css';

type TextMessageProps = {
    msg: Message;
    isEditing: boolean;
    onCancel: () => void;
    onSave: (content: string) => void;
};

const TextMessage = ({ msg, isEditing, onCancel, onSave }: TextMessageProps) => {
    const [draft, setDraft] = useState(msg.content);

    if (!isEditing) {
        return <p className='chat-message-text font-size-2-5 color-primary m-0'>{msg.content}</p>;
    }

    const handleEditSave = () => {
        if (draft.trim()) {
            onSave(draft);
        }
    };

    const handleEditCancel = () => {
        onCancel();
        setDraft(msg.content);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleEditSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleEditCancel();
        }
    };

    return (
        <div className='p-relative w-max'>
            <textarea
                value={draft}
                onChange={(e) => {
                    setDraft(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                }}
                onKeyDown={handleKeyDown}
                className='chat-message-edit-input w-max color-primary'
                autoFocus
                rows={1}
            />
            <div className='chat-message-edit-actions d-flex gap-025'>
                <Button
                    variant='ghost'
                    intent='success'
                    iconOnly
                    size='sm'
                    onClick={handleEditSave}
                >
                    <IoCheckmarkOutline size={14} />
                </Button>
                <Button
                    variant='ghost'
                    intent='danger'
                    iconOnly
                    size='sm'
                    onClick={handleEditCancel}
                >
                    <IoCloseOutline size={14} />
                </Button>
            </div>
            <div className='font-size-1 color-secondary mt-05' style={{ opacity: 0.7 }}>
                press <span className='font-weight-6'>enter</span> to save • <span className='font-weight-6'>esc</span> to cancel
            </div>
        </div>
    );
};

export default TextMessage;
