import { IoHappyOutline, IoEllipsisVerticalOutline, IoCreateOutline, IoTrashOutline } from 'react-icons/io5';
import Container from '@/shared/presentation/components/Container';
import Popover from '@/shared/presentation/components/Popover';
import PopoverMenu from '@/shared/presentation/components/PopoverMenu';
import PopoverMenuItem from '@/shared/presentation/components/PopoverMenuItem';
import IconButton from '@/shared/presentation/components/IconButton';
import EmojiPicker from '@/shared/presentation/components/EmojiPicker';
import { COMMON_REACTIONS } from '@/modules/chat/domain/constants';
import './MessageControls.css';

interface MessageControlsProps {
    messageId: string;
    isOwn: boolean;
    onReact: (emoji: string) => void;
    onEdit: () => void;
    onDelete: () => void;
};

const MessageControls = ({ messageId, isOwn, onReact, onEdit, onDelete }: MessageControlsProps) => (
    <Container className='d-flex gap-025 message-controls'>
        <Popover
            id={`reactions-${messageId}`}
            trigger={
                <IconButton size='sm' variant='ghost'>
                    <IoHappyOutline size={16} />
                </IconButton>
            }
        >
            {(close) => (
                <EmojiPicker
                    emojis={COMMON_REACTIONS}
                    onSelect={(emoji) => {
                        onReact(emoji);
                        close();
                    }}
                />
            )}
        </Popover>

        {isOwn && (
            <Popover
                id={`options-${messageId}`}
                trigger={
                    <IconButton size='sm' variant='ghost'>
                        <IoEllipsisVerticalOutline size={16} />
                    </IconButton>
                }
            >
                {(close) => (
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
                )}
            </Popover>
        )}
    </Container>
);

export default MessageControls;
