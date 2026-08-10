import {
    Autocomplete,
    Description,
    Label,
    ListBox,
    SearchField,
    Select,
    Spinner,
    cn
} from '@heroui/react';
import { getMultiSelectTriggerLabel } from '@/modules/plugin/contracts/select-option';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';
import type { UIEvent } from 'react';

/**
 * The two select shapes this module needs, on HeroUI's `Select` / `Autocomplete`.
 *
 * `FormFieldRHF` already covers every *labelled* select (it renders the same
 * `Select > Trigger > Value + Indicator` / `Popover > ListBox > Item` composition),
 * but eight call sites here drive a select directly — either because it is toolbar
 * chrome with no field row around it, or because it is multi-select, which
 * `FormFieldRHF` does not model.
 *
 * Which HeroUI family each maps to:
 *
 *   • single, no search  → `Select`. bravais's `value` / `onChange(value)` become
 *     `selectedKey` / `onSelectionChange`.
 *   • multi              → `Select selectionMode='multiple'`. React Aria's Select
 *     really does support it (`SelectProps<T, M>`, `value: readonly Key[]`), so
 *     this is the same component, not a hand-rolled listbox.
 *   • multi + search     → `Autocomplete`, whose Root *is* a RAC `Select` (so the
 *     multiple selection above still applies) and whose `.Filter` part is the
 *     text-filter provider bravais's `hasSearch` was.
 *
 * The one convention borrowed from `FormFieldRHF`: an empty-string value means "no
 * selection", so it is sent to `selectedKey` as `null`. RAC keys a collection by
 * `id`, and `''` is not a key any option here declares — the single call site whose
 * option list *does* carry `{ value: '', title: 'All Trajectories' }` uses that
 * same string as its placeholder, so the trigger reads identically either way.
 */

const SCROLL_END_THRESHOLD_PX = 24;

/** bravais's Select trigger showed the selected option's `title` and nothing else. */
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
    /*
     * bravais's `onScrollEnd` fired when the option list reached its end, which is
     * what pages the trajectory selector. RAC's ListBox is the scrollport, so the
     * handler goes straight on it.
     */
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
                <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                    <ListBox.ItemIndicator />
                    <Label>{option.title}</Label>
                    {option.description && <Description>{option.description}</Description>}
                </ListBox.Item>
            ))}
        </ListBox>
    );
};

/** bravais rendered its loader inside the open dropdown, below the options. */
const PendingRow = () => (
    <div className='flex flex-row items-center justify-center p-2'>
        <Spinner size='sm' />
    </div>
);

interface PluginSelectProps {
    options: SelectOption[];
    /** `''` and `null` both mean "nothing selected", as in bravais. */
    value: string | null;
    onChange: (value: string) => void;
    id?: string;
    placeholder?: string;
    isDisabled?: boolean;
    isPending?: boolean;
    onScrollEnd?: () => void;
    ariaLabel?: string;
    /** Lands on the `Select` root, which is the flex item of its container. */
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
    /** Renders a filter field inside the dropdown, as bravais's `hasSearch` did. */
    hasSearch?: boolean;
    searchPlaceholder?: string;
    ariaLabel?: string;
    className?: string;
    triggerClassName?: string;
    valueClassName?: string;
    /** Receives the selected count, exactly as bravais's `renderTriggerLabel` did. */
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

                <Autocomplete.Popover>
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
