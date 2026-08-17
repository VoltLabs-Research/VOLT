import { ListBox, Select, cn } from '@heroui/react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import { COMPACT_FIELD_TRIGGER, COMPACT_FIELD_VALUE } from '@/shared/ui/utils/field-density';

import type { SelectOption } from '@/modules/canvas/contracts/select-option';

interface CanvasOptionSelectProps {
    ariaLabel: string;
    options: SelectOption[];
    value: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    isDisabled?: boolean;

    size?: 'compact' | 'default';

    className?: string;

    triggerClassName?: string;

    showSelectionIcon?: boolean;
}

const CanvasOptionSelect = ({
    ariaLabel,
    options,
    value,
    onChange,
    placeholder,
    isDisabled = false,
    size = 'default',
    className,
    triggerClassName,
    showSelectionIcon = true
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
        className={cn('min-w-0', className)}
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
                        showIndicator={showSelectionIcon}
                    />
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default CanvasOptionSelect;
