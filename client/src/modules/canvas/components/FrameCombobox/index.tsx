import { ComboBox, Input, ListBox, cn } from '@heroui/react';
import { useMemo, useCallback } from 'react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import { COMPACT_FIELD_GROUP, COMPACT_FIELD_GROUP_INPUT } from '@/shared/ui/utils/field-density';

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
            <ComboBox.InputGroup className={cn(COMPACT_FIELD_GROUP, 'w-24', groupClassName)}>
                <Input className={COMPACT_FIELD_GROUP_INPUT} placeholder={placeholder} />
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
