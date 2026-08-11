import { Description, Label, ListBox, Select } from '@heroui/react';

export interface ClusterSelectOption {
    value: string;
    title: string;
    description?: string;
};

interface ClusterOptionSelectProps {
    ariaLabel: string;
    options: ClusterSelectOption[];
    value: string | null;
    onChange: (value: string) => void;
    placeholder?: string;
    isDisabled?: boolean;
};

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
