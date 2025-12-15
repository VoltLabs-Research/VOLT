import { IoCloseOutline } from 'react-icons/io5';

const DEFAULT_EMOJIS = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😉','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤓','😎','🤩','🥳','😏','😒','😞','😔','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴'];

type EmojiPickerProps = {
    onSelect: (e: string) => void;
    onClose: () => void;
    emojis?: string[]
}

const EmojiPicker = ({ onSelect, onClose, emojis = DEFAULT_EMOJIS }: EmojiPickerProps) => {
    return(
        <div className='chat-emoji-picker'>
            <div className='chat-emoji-picker-header'>
                <span>Select an emoji</span>
                <button type='button' className='chat-emoji-picker-close' onClick={onClose}><IoCloseOutline/></button>
            </div>
            <div className='chat-emoji-picker-grid'>
                {emojis.map((e) => (
                    <button key={e} type='button' className='chat-emoji-picker-item' onClick={() => onSelect(e)}>{e}</button>
                ))}
            </div>
        </div>
    );
};

export default EmojiPicker;
