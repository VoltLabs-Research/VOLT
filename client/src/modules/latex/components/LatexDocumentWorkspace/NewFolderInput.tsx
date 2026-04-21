import { Folder } from 'lucide-react';
import { useCallback, useState } from 'react';

interface NewFolderInputProps {
    onConfirm: (name: string) => Promise<unknown>;
    onCancel: () => void;
};

const FOLDER_ICON = <Folder size={14} />;

/** Characters that are not allowed in a folder name. */
const INVALID_CHARS_RE = /[/\\:*?"<>|]/;

/** Input field that collects a folder name and emits it on Enter. */
const NewFolderInput = ({ onConfirm, onCancel }: NewFolderInputProps) => {
    const [value, setValue] = useState('');

    const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>): Promise<void> => {
        if (e.key === 'Enter') {
            const name = value.trim();
            if (!name || INVALID_CHARS_RE.test(name)) return;
            await onConfirm(name);
        } else if (e.key === 'Escape') {
            onCancel();
        }
    }, [value, onConfirm, onCancel]);

    return (
        <div className='volt-container latex-workspace__new-file-input d-flex items-center gap-05 p-025'>
            <span className='color-muted d-flex items-center f-shrink-0'>{FOLDER_ICON}</span>
            <input
                autoFocus
                className='latex-workspace__new-file-field flex-1'
                placeholder='folder-name'
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={onCancel}
            />
        </div>
    );
};

export default NewFolderInput;
