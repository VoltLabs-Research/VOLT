import Container from '@/shared/presentation/components/Container';
import Button from '@/shared/presentation/components/Button';
import './EmojiPicker.css';

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '💯', '✨', '🙌', '💪'];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    emojis?: string[];
    columns?: number;
};

const EmojiPicker = ({ onSelect, emojis = DEFAULT_EMOJIS, columns = 6 }: EmojiPickerProps) => (
    <Container className='emoji-picker'>
        <Container
            className='emoji-picker-grid'
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
            {emojis.map((emoji) => (
                <Button
                    key={emoji}
                    variant='ghost'
                    intent='neutral'
                    iconOnly
                    size='sm'
                    onClick={() => onSelect(emoji)}
                >
                    {emoji}
                </Button>
            ))}
        </Container>
    </Container>
);

export default EmojiPicker;
