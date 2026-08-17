import Loader from '@/shared/ui/components/Loader';
import { Autocomplete, ListBox, SearchField, Select, cn } from '@heroui/react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import { getMultiSelectTriggerLabel } from '@/modules/plugin/contracts/select-option';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
import type { UIEvent } from 'react';

const SCROLL_END_THRESHOLD_PX = 24;

const renderSelectedTitle = ({
    isPlaceholder,
    selectedText,
    defaultChildren
}: {
    isPlaceholder: boolean;
    selectedText: string;
    defaultChildren: React.ReactNode;
}) => (isPlaceholder ? defaultChildren : selectedText);

interface SelectOptionListProps {
    options: SelectOption[];
    ariaLabel?: string;
    onScrollEnd?: () => void;
}

const SelectOptionList = ({ options, ariaLabel, onScrollEnd }: SelectOptionListProps) => {
    const handleScroll = onScrollEnd
        ? (event: UIEvent<HTMLDivElement>) => {
            const list = event.currentTarget;
            if (list.scrollHeight - list.scrollTop - list.clientHeight <= SCROLL_END_THRESHOLD_PX) {
                onScrollEnd();
            }
        }
        : undefined;

    return (
        <ListBox aria-label={ariaLabel} onScroll={handleScroll}>
            {options.map((option) => (
                <OptionListBoxItem key={option.value} option={option} />
            ))}
        </ListBox>
    );
};

const PendingRow = () => (
    <div className='flex flex-row items-center justify-center p-2'>
        <Loader size='sm' />
    </div>
);

interface PluginSelectProps {
    options: SelectOption[];

    value: string | null;
    onChange: (value: string) => void;
    id?: string;
    placeholder?: string;
    isDisabled?: boolean;
    isPending?: boolean;
    onScrollEnd?: () => void;
    ariaLabel?: string;

    className?: string;
    triggerClassName?: string;
    valueClassName?: string;
}

export const PluginSelect = ({
    options,
    value,
    onChange,
    id,
    placeholder,
    isDisabled,
    isPending,
    onScrollEnd,
    ariaLabel,
    className,
    triggerClassName,
    valueClassName
}: PluginSelectProps) => (
    <Select
        id={id}
        className={className}
        selectedKey={value || null}
        onSelectionChange={(key) => onChange(key === null ? '' : String(key))}
        placeholder={placeholder}
        isDisabled={isDisabled}
        aria-label={ariaLabel}
    >
        <Select.Trigger className={triggerClassName}>
            <Select.Value className={valueClassName}>{renderSelectedTitle}</Select.Value>
            <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
            <SelectOptionList options={options} ariaLabel={ariaLabel} onScrollEnd={onScrollEnd} />
            {isPending && <PendingRow />}
        </Select.Popover>
    </Select>
);

interface PluginMultiSelectProps {
    options: SelectOption[];
    selectedValues: string[];
    onMultiChange: (values: string[]) => void;
    id?: string;
    placeholder: string;
    isDisabled?: boolean;

    hasSearch?: boolean;
    searchPlaceholder?: string;
    ariaLabel?: string;
    className?: string;
    triggerClassName?: string;
    valueClassName?: string;

    renderTriggerLabel?: (selectedCount: number) => string;
}

export const PluginMultiSelect = ({
    options,
    selectedValues,
    onMultiChange,
    id,
    placeholder,
    isDisabled,
    hasSearch,
    searchPlaceholder = 'Search…',
    ariaLabel,
    className,
    triggerClassName,
    valueClassName,
    renderTriggerLabel
}: PluginMultiSelectProps) => {
    const triggerLabel = renderTriggerLabel
        ? renderTriggerLabel(selectedValues.length)
        : getMultiSelectTriggerLabel(selectedValues.length, selectedValues, options, placeholder, 'selected');

    const handleChange = (keys: React.Key[]) => {
        onMultiChange(keys.map((key) => String(key)));
    };

    if (hasSearch) {
        return (
            <Autocomplete
                id={id}
                className={className}
                selectionMode='multiple'
                value={selectedValues}
                onChange={handleChange}
                placeholder={placeholder}
                isDisabled={isDisabled}
                aria-label={ariaLabel}
            >
                <Autocomplete.Trigger className={triggerClassName}>
                    <Autocomplete.Value className={valueClassName}>{triggerLabel}</Autocomplete.Value>
                    <Autocomplete.Indicator />
                </Autocomplete.Trigger>
                <Autocomplete.Popover className='w-auto min-w-56 max-w-none'>
                    <Autocomplete.Filter>
                        <SearchField autoFocus aria-label={searchPlaceholder}>
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input placeholder={searchPlaceholder} />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                        <SelectOptionList options={options} ariaLabel={ariaLabel} />
                    </Autocomplete.Filter>
                </Autocomplete.Popover>
            </Autocomplete>
        );
    }

    return (
        <Select
            id={id}
            className={className}
            selectionMode='multiple'
            value={selectedValues}
            onChange={handleChange}
            placeholder={placeholder}
            isDisabled={isDisabled}
            aria-label={ariaLabel}
        >
            <Select.Trigger className={triggerClassName}>
                <Select.Value className={cn('truncate', valueClassName)}>{triggerLabel}</Select.Value>
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <SelectOptionList options={options} ariaLabel={ariaLabel} />
            </Select.Popover>
        </Select>
    );
};
