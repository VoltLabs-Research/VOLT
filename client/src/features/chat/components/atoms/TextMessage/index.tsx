import { useState } from 'react';
import { IoCheckmarkOutline, IoCloseOutline } from 'react-icons/io5';
import type { Message } from '@/types/chat';
import Paragraph from '@/components/primitives/Paragraph';
import Container from '@/components/primitives/Container';
import Button from '@/components/primitives/Button';
import Tooltip from '@/components/atoms/common/Tooltip';
import '@/features/chat/components/atoms/TextMessage/TextMessage.css';

type TextMessageProps = {
    msg: Message;
    onSave: (content: string) => void;
};

const TextMessage = ({ msg, onSave }: TextMessageProps) => {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(msg.content);

    if (!isEditing) {
        return <Paragraph className='chat-message-text font-size-2-5 color-primary'>{msg.content}</Paragraph>;
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
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} className='chat-message-edit-input w-max color-primary p-05' autoFocus />
            <Container className='d-flex gap-05 content-end'>
                <Tooltip content="Save" placement="top">
                    <Button
                        variant='solid'
                        intent='success'
                        iconOnly
                        size='sm'
                        onClick={handleEditSave}
                    >
                        <IoCheckmarkOutline />
                    </Button>
                </Tooltip>

                <Tooltip content="Cancel" placement="top">
                    <Button
                        variant='ghost'
                        intent='neutral'
                        iconOnly
                        size='sm'
                        onClick={handleEditCancel}
                    >
                        <IoCloseOutline />
                    </Button>
                </Tooltip>
            </Container>
        </Container>
    );
};

export default TextMessage;
