import { IoCloseOutline, IoCloseCircleOutline } from 'react-icons/io5';
import { formatSize } from '@/utilities/scene-utils';

type Item = {
    file: File,
    preview: String
}

type FilePreviewsBarProps = {
    items: Item[];
    onClear: () => void;
    onRemove: (index: number) => void;
}

const FilePreviewsBar = ({ items, onClear, onRemove }: FilePreviewsBarProps) => {
    if(!items.length) return null;

    return (
        <div className='chat-file-previews-container'>
            <div className='chat-file-previews-header'>
                <span>Archivos seleccionados ({items.length})</span>
                <button
                    type='button'
                    className='chat-clear-files'
                    onClick={onClear}
                >
                    <IoCloseOutline/>
                </button>
            </div>
            <div className='chat-file-previews-grid'>
                {items.map((item, index) => (
                <div key={index} className='chat-file-preview-item'>
                    <img
                        src={item.preview}
                        alt={item.file.name}
                        className='chat-file-preview-image' />

                    <div className='chat-file-preview-info'>
                        <span className='chat-file-preview-name'>{item.file.name}</span>
                        <span className='chat-file-preview-size'>{formatSize(item.file.size)}</span>
                    </div>

                    <button 
                        type='button' 
                        className='chat-file-preview-remove' 
                        onClick={() => onRemove(index)}
                    >
                        <IoCloseCircleOutline/>
                    </button>
                </div>
                ))}
            </div>
        </div>
    );
};

export default FilePreviewsBar;