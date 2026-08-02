import { Row } from '@voltstack/bravais';
import { useState } from 'react';
import type { ReactNode } from 'react';

interface WorkspaceEntryInputProps {
    icon: ReactNode;
    label: string;
    placeholder: string;
    onConfirm: (value: string) => Promise<unknown>;
    onCancel: () => void;
}

const WorkspaceEntryInput = ({
    icon,
    label,
    placeholder,
    onConfirm,
    onCancel
}: WorkspaceEntryInputProps) => {
    const [value, setValue] = useState('');

    const handleKeyDown = async (event: React.KeyboardEvent<HTMLInputElement>): Promise<void> => {
        if (event.key === 'Enter') {
            const nextValue = value.trim();
            if (!nextValue) {
                return;
            }

            await onConfirm(nextValue);
            return;
        }

        if (event.key === 'Escape') {
            onCancel();
        }
    };

    return (
        <Row gap='05' p='025' className='latex-workspace__new-file-input'>
            <Row as='span' shrink='0' className='color-muted'>{icon}</Row>
            <input
                autoFocus
                className='latex-workspace__new-file-field flex-1'
                aria-label={label}
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={onCancel}
            />
        </Row>
    );
};

export default WorkspaceEntryInput;
