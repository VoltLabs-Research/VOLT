import { COMMON_REACTIONS } from '@/modules/chat/utils/reactions';
import { IoHappyOutline, IoEllipsisVerticalOutline, IoCreateOutline, IoTrashOutline } from 'react-icons/io5';
import EmojiPicker from '@/shared/ui/components/EmojiPicker';
import { Box, IconButton, Popover, PopoverMenuItem, PopoverMenu } from '@voltstack/bravais';
import './MessageControls.css';

interface MessageControlsProps {
    messageId: string;
    isOwn: boolean;
    onReact: (emoji: string) => void;
    onEdit: () => void;
    onDelete: () => void;
}

const MessageControls = ({ messageId, isOwn, onReact, onEdit, onDelete }: MessageControlsProps) => {
    const renderEmojiPicker = (close: () => void) => (
        <EmojiPicker
            emojis={COMMON_REACTIONS}
            onSelect={(emoji) => {
                onReact(emoji);
                close();
            }}
        />
    );

    const renderOptionsMenu = (close: () => void) => (
        <PopoverMenu>
            <PopoverMenuItem
                icon={<IoCreateOutline />}
                label='Edit'
                onClick={() => {
                    onEdit();
                    close();
                }}
            />
            <PopoverMenuItem
                icon={<IoTrashOutline />}
                label='Delete'
                variant='danger'
                onClick={() => {
                    onDelete();
                    close();
                }}
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
