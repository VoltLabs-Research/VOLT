import { IoCloseOutline } from 'react-icons/io5';
import Button from '@/shared/presentation/components/primitives/Button';
import Tooltip from '@/shared/presentation/components/atoms/common/Tooltip';
import '@/modules/chat/presentation/components/atoms/EmojiPicker/EmojiPicker.css';

const DEFAULT_EMOJIS = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😉', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴'];

type EmojiPickerProps = {
    onSelect: (e: string) => void;
    onClose: () => void;
    emojis?: string[]
}

const EmojiPicker = ({ onSelect, onClose, emojis = DEFAULT_EMOJIS }: EmojiPickerProps) => {
    return (
        <div className='chat-emoji-picker p-absolute overflow-hidden'>
            <div className='d-flex items-center content-between chat-emoji-picker-header'>
                <span>Select an emoji</span>
                <Tooltip content="Close" placement="left">
                    <Button variant='ghost' intent='neutral' iconOnly size='sm' onClick={onClose}><IoCloseOutline /></Button>
                </Tooltip>
            </div>
            <div className='chat-emoji-picker-grid gap-025 y-auto'>
                {emojis.map((e) => (
                    <Button key={e} variant='ghost' intent='neutral' iconOnly size='sm' onClick={() => onSelect(e)}>{e}</Button>
                ))}
            </div>
        </div>
    );
};

export default EmojiPicker;
