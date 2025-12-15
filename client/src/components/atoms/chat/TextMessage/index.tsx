import { useState } from 'react';
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import type { Message } from '@/types/chat';
import Paragraph from '@/components/primitives/Paragraph';

type TextMessageProps = {
    msg: Message;
    onSave: (content: string) => void;
};

const TextMessage = ({ msg, onSave }: TextMessageProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(msg.content);

    if (!isEditing) {
        return <Paragraph className='chat-message-text'>{msg.content}</Paragraph>;
    }

    const handleEditSave = () => {
        if (draft.trim()) {
            onSave(draft);
        }

        setIsEditing(false);
    };

    const handleEditCancel = () => {
        setIsEditing(false);
        setDraft(msg.content);
    };

    return (
        <div className='chat-message-edit'>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className='chat-message-edit-input' autoFocus />
            <div className='chat-message-edit-actions'>
                <button
                    className='chat-message-edit-save'
                    onClick={handleEditSave}
                >
                    <IoCheckmarkOutline />
                </button>

                <button
                    className='chat-message-edit-cancel'
                    onClick={handleEditCancel}
                >
                    <IoCloseOutline />
                </button>
            </div>
        </div>
    );
};

export default TextMessage;
