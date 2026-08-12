import { Description, Label, ListBox, Select, cn } from '@heroui/react';

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
        <Select.Trigger className={cn(size === 'compact' ? 'h-6 min-h-6 rounded-lg px-1.5 text-2xs' : '', triggerClassName)}>
            <Select.Value className={size === 'compact' ? 'text-2xs' : ''}>
                {({ isPlaceholder, selectedText, defaultChildren }) => (
                    isPlaceholder ? defaultChildren : selectedText
                )}
            </Select.Value>
            <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
            <ListBox>
                {options.map((option) => (
                    <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                        {showSelectionIcon && <ListBox.ItemIndicator />}
                        <Label>{option.title}</Label>
                        {option.description && <Description>{option.description}</Description>}
                    </ListBox.Item>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default CanvasOptionSelect;
