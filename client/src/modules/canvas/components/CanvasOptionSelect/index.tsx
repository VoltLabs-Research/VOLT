import { ListBox, Select, cn } from '@heroui/react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import { COMPACT_FIELD_TRIGGER, COMPACT_FIELD_VALUE } from '@/shared/ui/utils/field-density';

import type { SelectOption } from '@/shared/contracts/form-field';

interface CanvasOptionSelectProps {
    ariaLabel: string;
    options: SelectOption[];
    value: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    isDisabled?: boolean;

    size?: 'compact' | 'default';

    triggerClassName?: string;
}

const CanvasOptionSelect = ({
    ariaLabel,
    options,
    value,
    onChange,
    placeholder,
    isDisabled = false,
    size = 'default',
    triggerClassName
}: CanvasOptionSelectProps) => (
    <Select
        aria-label={ariaLabel}
        selectedKey={value}
        onSelectionChange={(key) => {
            if (key === null) {
                return;
            }

            onChange(String(key));
        }}
        placeholder={placeholder}
        isDisabled={isDisabled}
        fullWidth
        className='min-w-0'
    >
        <Select.Trigger className={cn(size === 'compact' ? COMPACT_FIELD_TRIGGER : '', triggerClassName)}>
            <Select.Value className={size === 'compact' ? COMPACT_FIELD_VALUE : 'min-w-0 truncate'}>
                {({ isPlaceholder, selectedText, defaultChildren }) => (
                    isPlaceholder ? defaultChildren : selectedText
                )}
            </Select.Value>
            <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
            <ListBox>
                {options.map((option) => (
                    <OptionListBoxItem
                        key={option.value}
                        option={option}
                        showIndicator
                    />
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default CanvasOptionSelect;
