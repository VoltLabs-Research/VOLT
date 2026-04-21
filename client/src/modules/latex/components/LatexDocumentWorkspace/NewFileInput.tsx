import { FileText } from 'lucide-react';
import { useCallback, useState } from 'react';

interface NewFileInputProps {
    onConfirm: (name: string) => Promise<unknown>;
    onCancel: () => void;
};

const FILE_ICON = <FileText size={14} />;

const NewFileInput = ({ onConfirm, onCancel }: NewFileInputProps) => {
    const [value, setValue] = useState('');

    const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>): Promise<void> => {
        if (e.key === 'Enter' && value.trim()) {
            const name = value.trim().endsWith('.tex') ? value.trim() : `${value.trim()}.tex`;
            await onConfirm(name);
        } else if (e.key === 'Escape') {
            onCancel();
        }
    }, [value, onConfirm, onCancel]);

    return (
        <div className='volt-container latex-workspace__new-file-input d-flex items-center gap-05 p-025'>
            <span className='color-muted d-flex items-center f-shrink-0'>{FILE_ICON}</span>
            <input
                autoFocus
                className='latex-workspace__new-file-field flex-1'
                placeholder='filename.tex'
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={onCancel}
            />
        </div>
    );
};

export default NewFileInput;
