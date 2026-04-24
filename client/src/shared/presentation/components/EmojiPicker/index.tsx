import Button from '@/shared/presentation/primitives/Button';
import './EmojiPicker.css';

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '💯', '✨', '🙌', '💪'];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    emojis?: string[];
    columns?: number;
};

const EmojiPicker = ({ onSelect, emojis = DEFAULT_EMOJIS, columns = 6 }: EmojiPickerProps) => (
    <div className='emoji-picker' role='group' aria-label='Emoji picker'>
        <div className='emoji-picker-grid' role='list' aria-label='Available emojis' style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {emojis.map((emoji) => (
                <div className="" key={emoji} role='listitem'>
                    <Button
                        className='emoji-picker-option'
                        variant='ghost'
                        intent='neutral'
                        iconOnly
                        size='sm'
                        aria-label={`Select ${emoji} emoji`}
                        title={`Select ${emoji}`}
                        onClick={() => onSelect(emoji)}
                    >
                        {emoji}
                    </Button>
                </div>
            ))}
        </div>
    </div>
);

export default EmojiPicker;
