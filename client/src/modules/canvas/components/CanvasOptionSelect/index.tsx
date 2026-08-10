import { Description, Label, ListBox, Select, cn } from '@heroui/react';

import type { SelectOption } from '@/modules/canvas/contracts/select-option';

interface CanvasOptionSelectProps {
    /**
     * REQUIRED. bravais's `Select` shipped without an accessible name at most canvas
     * call sites — each sits in a labelled row or submenu, which names the group but
     * not the control — and React Aria warns for an unnamed Select.
     */
    ariaLabel: string;
    options: SelectOption[];
    value: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    isDisabled?: boolean;
    /**
     * `compact` is the 24px canvas row language that
     * `.context-menu-submenu-panel .select-trigger` used to impose on every select
     * inside a render/camera submenu: 24px tall, 0.7rem, 8px radius.
     */
    size?: 'compact' | 'default';
    /** Forwarded to the Select root, last, so a caller can still override. */
    className?: string;
    /** bravais's `showSelectionIcon`: the checkmark beside the chosen option. */
    showSelectionIcon?: boolean;
}

const TRIGGER_CLASS: Record<'compact' | 'default', string> = {
    compact: 'h-6 min-h-6 rounded-lg px-[0.4rem] text-[0.7rem]',
    default: ''
};

const VALUE_CLASS: Record<'compact' | 'default', string> = {
    compact: 'text-[0.7rem]',
    default: ''
};

/**
 * Every `<Select options value onChange>` call site in the canvas module, on HeroUI's
 * compound Select.
 *
 * `Select.Value`'s render prop is the one `FormFieldRHF`'s renderers use, and for the
 * same reason: RAC's default children render the whole selected item, so an option's
 * `description` would leak into the trigger, where bravais showed the `title` alone.
 *
 * `onSelectionChange` fires with `null` when a selection is cleared. bravais's
 * `onChange` could only ever be called with a real option value, so the null is
 * swallowed rather than forwarded as an empty string.
 */
const CanvasOptionSelect = ({
    ariaLabel,
    options,
    value,
    onChange,
    placeholder,
    isDisabled = false,
    size = 'default',
    className,
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
        <Select.Trigger className={TRIGGER_CLASS[size]}>
            <Select.Value className={VALUE_CLASS[size]}>
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
