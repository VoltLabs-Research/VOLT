import {
    IoHappyOutline,
    IoEllipsisVerticalOutline,
    IoCreateOutline,
    IoTrashOutline
} from 'react-icons/io5';
import './MessageControls.css';
import Container from '@/components/primitives/Container';
import Button from '@/components/primitives/Button';

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
    return (
        <Container className='d-flex gap-025 p-absolute chat-message-controls'>
            <Button
                variant='ghost'
                intent='neutral'
                iconOnly
                size='sm'
                onClick={onOpenReactions}
            >
                <IoHappyOutline />
            </Button>

            {isOwn && (
                <Container className='p-relative'>
                    <Button
                        variant='ghost'
                        intent='neutral'
                        iconOnly
                        size='sm'
                        onClick={onOpenOptions}
                    >
                        <IoEllipsisVerticalOutline />
                    </Button>

                    {isOptionsOpen && (
                        <Container className='chat-message-options-menu p-absolute overflow-hidden'>
                            <Button
                                variant='ghost'
                                intent='neutral'
                                size='sm'
                                leftIcon={<IoCreateOutline />}
                                onClick={onEdit}
                                block
                                className='content-start'
                            >
                                Edit
                            </Button>
                            <Button
                                variant='ghost'
                                intent='danger'
                                size='sm'
                                leftIcon={<IoTrashOutline />}
                                onClick={onDelete}
                                block
                                className='content-start'
                            >
                                Delete
                            </Button>
                        </Container>
                    )}
                </Container>
            )}
        </Container>
    );
};

export default MessageControls;
