import { ListBox, Select } from '@heroui/react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';

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
                    <OptionListBoxItem key={option.value} option={option} />
                ))}
            </ListBox>
        </Select.Popover>
    </Select>
);

export default ClusterOptionSelect;
