import { ComboBox, Input, Label, ListBox, cn } from '@heroui/react';
import { useMemo, useCallback } from 'react';

import type { SelectOption } from '@/modules/canvas/contracts/select-option';

interface FrameComboboxProps {
    value: number | undefined;
    options: number[];
    onChange: (value: number | undefined) => void;

    title?: string;

    className?: string;

    groupClassName?: string;
}

const FrameCombobox = ({ value, options, onChange, title, className, groupClassName }: FrameComboboxProps) => {
    const selectOptions: SelectOption[] = useMemo(
        () => options.map((n) => ({
            value: String(n),
            title: String(n)
        })),
        [options]
    );

    const handleSelectionChange = useCallback((key: string | null) => {
        if (key === null || key === '') {
            onChange(undefined);
            return;
        }

        const nextValue = Number(key);
        onChange(Number.isFinite(nextValue) ? nextValue : undefined);
    }, [onChange]);

    const normalizedValue = value !== undefined ? String(value) : null;
    const placeholder = value !== undefined ? String(value) : 'No frames';

    return (
        <ComboBox
            className={cn('min-w-0 shrink-0', className)}
            selectedKey={normalizedValue}
            onSelectionChange={(key) => handleSelectionChange(key === null ? null : String(key))}
            isDisabled={options.length === 0}
            aria-label={title ?? 'Select frame'}
        >
            <ComboBox.InputGroup className={cn('h-6 min-h-6 w-24 rounded-lg border border-border bg-transparent shadow-none transition-colors duration-150 ease-out hover:border-border-secondary', groupClassName)}>
                <Input className='h-6 min-h-6 border-0 bg-transparent px-1.5 text-2xs text-foreground shadow-none placeholder:text-2xs placeholder:text-muted' placeholder={placeholder} />
                <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
                <ListBox>
                    {selectOptions.map((option) => (
                        <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                            <Label>{option.title}</Label>
                        </ListBox.Item>
                    ))}
                </ListBox>
            </ComboBox.Popover>
        </ComboBox>
    );
};

export default FrameCombobox;
