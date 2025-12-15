import {
    IoHappyOutline,
    IoEllipsisVerticalOutline,
    IoCreateOutline,
    IoTrashOutline } from 'react-icons/io5';
import './MessageControls.css';
import Container from '@/components/primitives/Container';

export type MessageControlsProps = {
    isOwn: boolean;
    isOptionsOpen: boolean;
    onOpenReactions: () => void;
    onOpenOptions: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const MessageControls = ({
    isOwn,
    isOptionsOpen,
    onOpenReactions,
    onOpenOptions,
    onEdit,
    onDelete
}: MessageControlsProps) => {
    return(
        <Container className='d-flex gap-025 p-absolute chat-message-controls'>
            <button
                className='chat-message-reaction-btn'
                onClick={onOpenReactions}
            >
                <IoHappyOutline/>
            </button>

            {isOwn && (
                <Container className='p-relative'>
                    <button
                        className='chat-message-options'
                        onClick={onOpenOptions}
                    >
                        <IoEllipsisVerticalOutline/>
                    </button>

                    {isOptionsOpen && (
                        <Container className='chat-message-options-menu'>
                            <button
                                className='chat-message-option'
                                onClick={onEdit}
                            >
                                <IoCreateOutline/> Edit
                            </button>
                            <button
                                className='chat-message-option danger'
                                onClick={onDelete}
                            >
                                <IoTrashOutline/> Delete
                            </button>
                        </Container>
                    )}
                </Container>
            )}
        </Container>
    );
};

export default MessageControls;
