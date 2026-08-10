import { Description, Label, ListBox, Select } from '@heroui/react';

/**
 * bravais's `SelectOption`, re-declared here because the type went with the
 * library. Same three fields, same optionality, so every existing option array
 * satisfies it unchanged.
 */
export interface ClusterSelectOption {
    value: string;
    title: string;
    description?: string;
};

interface ClusterOptionSelectProps {
    /**
     * REQUIRED. bravais's `Select` shipped without an accessible name at both of
     * this module's call sites — each sits under its own `<h3>`, which labels the
     * group but not the control. React Aria warns for an unnamed Select, so the
     * name is a prop rather than an omission.
     */
    ariaLabel: string;
    options: ClusterSelectOption[];
    value: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    isDisabled?: boolean;
};

/**
 * The two `<Select options value onChange>` call sites in this module, on HeroUI's
 * compound Select.
 *
 * `Select.Value`'s render prop is the same one `FormFieldRHF`'s stacked renderer
 * uses, and for the same reason: RAC's default children render the whole selected
 * item, so an option's `description` would otherwise leak into the trigger, where
 * bravais showed the `title` alone.
 *
 * `onSelectionChange` fires with `null` when a selection is cleared. bravais's
 * `onChange` could only ever be called with a real option value, so the null is
 * swallowed rather than forwarded as an empty string.
 */
const ClusterOptionSelect = ({
    ariaLabel,
    options,
    value,
    onChange,
    placeholder,
    isDisabled = false
}: ClusterOptionSelectProps) => (
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
    >
        <Select.Trigger>
            <Select.Value>
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
                        <ListBox.ItemIndicator />
                        <Label>{option.title}</Label>
                        {option.description && <Description>{option.description}</Description>}
                    </ListBox.Item>
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default ClusterOptionSelect;
