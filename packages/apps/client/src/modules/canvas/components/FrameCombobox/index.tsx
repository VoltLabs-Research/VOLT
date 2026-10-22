import { ComboBox, Input, ListBox, cn } from '@heroui/react';
import { useMemo, useCallback } from 'react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';

import type { SelectOption } from '@/shared/contracts/form-field';

interface FrameComboboxProps {
    value: number | undefined;
    options: number[];
    onChange: (value: number | undefined) => void;

    title?: string;

    groupClassName?: string;
}

const FrameCombobox = ({ value, options, onChange, title, groupClassName }: FrameComboboxProps) => {
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
            className='min-w-0 shrink-0'
            selectedKey={normalizedValue}
            onSelectionChange={(key) => handleSelectionChange(key === null ? null : String(key))}
            isDisabled={options.length === 0}
            aria-label={title ?? 'Select frame'}
        >
            <ComboBox.InputGroup className={cn('h-7 min-h-7 w-24 overflow-hidden rounded-full border-0 bg-foreground/5 text-xs shadow-none transition-colors duration-[140ms] hover:bg-foreground/[0.08] focus-within:bg-foreground/[0.08]', groupClassName)}>
                <Input className='h-7 min-h-7 border-0 bg-transparent pl-3 text-xs tabular-nums text-foreground shadow-none placeholder:text-muted' placeholder={placeholder} />
                <ComboBox.Trigger />
            </ComboBox.InputGroup>
            <ComboBox.Popover>
                <ListBox>
                    {selectOptions.map((option) => (
                        <OptionListBoxItem key={option.value} option={option} showIndicator={false} />
                    ))}
                </ListBox>
            </ComboBox.Popover>
        </ComboBox>
    );
};

export default FrameCombobox;
