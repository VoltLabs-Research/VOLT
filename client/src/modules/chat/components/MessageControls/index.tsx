import { COMMON_REACTIONS } from '@/modules/chat/utils/reactions';
import { EllipsisVertical, Smile, SquarePen, Trash2 } from 'lucide-react';
import EmojiPicker from '@/shared/ui/components/EmojiPicker';
import { IconButton, Popover, PopoverMenuItem, PopoverMenu } from '@voltstack/bravais';
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
                icon={<SquarePen />}
                label='Edit'
                onClick={() => {
                    onEdit();
                    close();
                }}
            />
            <PopoverMenuItem
                icon={<Trash2 />}
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
        <div className='flex gap-1 message-controls'>
            <Popover
                id={`reactions-${messageId}`}
                trigger={
                    <IconButton size='sm' variant='ghost' title='Add reaction' aria-label='Add reaction'>
                        <Smile size={16} />
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
                            <EllipsisVertical size={16} />
                        </IconButton>
                    }
                >
                    {renderOptionsMenu}
                </Popover>
            )}
        </div>
    );
};

export default MessageControls;
