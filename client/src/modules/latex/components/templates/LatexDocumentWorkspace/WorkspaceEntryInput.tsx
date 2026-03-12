import Container from '@/shared/presentation/components/Container';
import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';

interface WorkspaceEntryInputProps {
    icon: ReactNode;
    placeholder: string;
    defaultValue?: string;
    onConfirm: (value: string) => Promise<unknown>;
    onCancel: () => void;
}

const WorkspaceEntryInput = ({
    icon,
    placeholder,
    defaultValue = '',
    onConfirm,
    onCancel
}: WorkspaceEntryInputProps) => {
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
        <Container className='latex-workspace__new-file-input d-flex items-center gap-05 p-025'>
            <span className='color-muted d-flex items-center f-shrink-0'>{icon}</span>
            <input
                autoFocus
                className='latex-workspace__new-file-field flex-1'
                placeholder={placeholder}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={onCancel}
            />
        </Container>
    );
};

export default WorkspaceEntryInput;
