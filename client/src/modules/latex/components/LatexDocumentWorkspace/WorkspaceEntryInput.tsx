import Row from '@/shared/presentation/primitives/Row';
import { useCallback, useId, useState } from 'react';
import type { ReactNode } from 'react';

interface WorkspaceEntryInputProps {
    icon: ReactNode;
    label: string;
    placeholder: string;
    defaultValue?: string;
    onConfirm: (value: string) => Promise<unknown>;
    onCancel: () => void;
}

const WorkspaceEntryInput = ({
    icon,
    label,
    placeholder,
    defaultValue = '',
    onConfirm,
    onCancel
}: WorkspaceEntryInputProps) => {
    const inputId = useId();
    const [value, setValue] = useState(defaultValue);

    const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>): Promise<void> => {
        if (e.key === 'Enter') {
            const nextValue = value.trim();
            if (!nextValue) {
                return;
            }

            await onConfirm(nextValue);
            return;
        }

        if (e.key === 'Escape') {
            onCancel();
        }
    }, [onCancel, onConfirm, value]);

    return (
        <Row gap='05' p='025' className='latex-workspace__new-file-input'>
            <span className='color-muted d-flex items-center f-shrink-0'>{icon}</span>
            <label htmlFor={inputId} className='latex-workspace__sr-only'>
                {label}
            </label>
            <input
                id={inputId}
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
