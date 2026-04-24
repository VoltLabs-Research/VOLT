import { COMMON_REACTIONS } from '@/modules/chat/api/entities/shared/chat-constants';
import { IoHappyOutline, IoEllipsisVerticalOutline, IoCreateOutline, IoTrashOutline } from 'react-icons/io5';
import EmojiPicker from '@/shared/presentation/components/EmojiPicker';
import Box from '@/shared/presentation/primitives/Box';
import IconButton from '@/shared/presentation/primitives/IconButton';
import Popover from '@/shared/presentation/primitives/Popover';
import PopoverMenuItem from '@/shared/presentation/primitives/PopoverMenuItem';
import PopoverMenu from '@/shared/presentation/primitives/PopoverMenu';
import './MessageControls.css';

interface MessageControlsProps {
    messageId: string;
    isOwn: boolean;
    onReact: (emoji: string) => void;
    onEdit: () => void;
    onDelete: () => void;
};

const MessageControls = ({ messageId, isOwn, onReact, onEdit, onDelete }: MessageControlsProps) => {
    const handleEmojiSelect = (close: () => void, emoji: string) => {
        onReact(emoji);
        close();
    };

    const handleEditClick = (close: () => void) => {
        onEdit();
        close();
    };

    const handleDeleteClick = (close: () => void) => {
        onDelete();
        close();
    };

    const renderEmojiPicker = (close: () => void) => (
        <EmojiPicker
            emojis={COMMON_REACTIONS}
            onSelect={(emoji) => handleEmojiSelect(close, emoji)}
        />
    );

    const renderOptionsMenu = (close: () => void) => (
        <PopoverMenu>
            <PopoverMenuItem
                icon={<IoCreateOutline />}
                label='Edit'
                onClick={() => handleEditClick(close)}
            />
            <PopoverMenuItem
                icon={<IoTrashOutline />}
                label='Delete'
                variant='danger'
                onClick={() => handleDeleteClick(close)}
            />
        </PopoverMenu>
    );

    return (
        <Box display='flex' gap='025' className='message-controls'>
            <Popover
                id={`reactions-${messageId}`}
                trigger={
                    <IconButton size='sm' variant='ghost' title='Add reaction' aria-label='Add reaction'>
                        <IoHappyOutline size={16} />
                    </IconButton>
                }
            >
                {renderEmojiPicker}
            </Popover>

            {isOwn && (
                <Popover
                    id={`options-${messageId}`}
                    trigger={
                        <IconButton size='sm' variant='ghost' title='Open message actions' aria-label='Open message actions'>
                            <IoEllipsisVerticalOutline size={16} />
                        </IconButton>
                    }
                >
                    {renderOptionsMenu}
                </Popover>
            )}
        </Box>
    );
};

export default MessageControls;
