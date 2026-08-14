import { Button } from '@heroui/react';
import Scrollable from '@/shared/ui/components/Scrollable';

const DEFAULT_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏', '💯', '✨', '🙌', '💪'];

interface EmojiPickerProps {
    onSelect: (emoji: string) => void;
    emojis?: string[];
    columns?: number;
};

const EmojiPicker = ({ onSelect, emojis = DEFAULT_EMOJIS, columns = 6 }: EmojiPickerProps) => (
    <Scrollable
        className='max-h-[min(18rem,60vh)] animate-[emoji-picker-slide_0.2s_cubic-bezier(0.25,0.46,0.45,0.94)] overscroll-contain rounded-xl border border-border bg-surface-tertiary p-2 shadow-lg'
        role='group'
        aria-label='Emoji picker'
    >
        <div className='grid gap-1' role='list' aria-label='Available emojis' style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {emojis.map((emoji) => (
                <div key={emoji} role='listitem' title={`Select ${emoji}`}>
                    <Button
                        className='w-full'
                        variant='ghost'
                        isIconOnly
                        size='sm'
                        aria-label={`Select ${emoji} emoji`}
                        onPress={() => onSelect(emoji)}
                    >
                        {emoji}
                    </Button>
                </div>
            ))}
        </div>
    </Scrollable>
);

export default EmojiPicker;
