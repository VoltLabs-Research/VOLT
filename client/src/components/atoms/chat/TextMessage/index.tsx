import { useState } from 'react';
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import type { Message } from '@/types/chat';
import Paragraph from '@/components/primitives/Paragraph';
import Container from '@/components/primitives/Container';
import './TextMessage.css';

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
        <Container className='d-flex column gap-05'>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className='chat-message-edit-input' autoFocus />
            <Container className='d-flex gap-05 content-end'>
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
            </Container>
        </Container>
    );
};

export default TextMessage;
