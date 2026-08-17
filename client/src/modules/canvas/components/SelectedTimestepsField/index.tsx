import { Autocomplete, ListBox, SearchField, cn } from '@heroui/react';
import { useMemo, useCallback } from 'react';
import OptionListBoxItem from '@/shared/ui/components/OptionListBoxItem';
import {
    COMPACT_FIELD_LABEL,
    COMPACT_FIELD_TRIGGER,
    COMPACT_FIELD_VALUE
} from '@/shared/ui/utils/field-density';

import type { Key } from 'react';
import type { SelectOption } from '@/modules/canvas/contracts/select-option';

interface SelectedTimestepsFieldProps {
    availableTimesteps: number[];
    selectedTimesteps?: number[];
    onChange: (selectedTimesteps?: number[]) => void;
}

const ALL_OPTION_KEY = '__all__';

const ALL_OPTION: SelectOption = {
    value: ALL_OPTION_KEY,
    title: 'All'
};

const SelectedTimestepsField = ({
    availableTimesteps,
    selectedTimesteps,
    onChange
}: SelectedTimestepsFieldProps) => {
    const options: SelectOption[] = useMemo(
        () => availableTimesteps.map((t) => ({
            value: String(t),
            title: String(t)
        })),
        [availableTimesteps]
    );

    const selectedValues = useMemo(
        () => selectedTimesteps?.map(String) ?? [],
        [selectedTimesteps]
    );

    const handleMultiChange = useCallback((values: string[]) => {
        if (!values.length || values.length === availableTimesteps.length) {
            onChange(undefined);
            return;
        }
        onChange(values.map(Number));
    }, [availableTimesteps.length, onChange]);

    const handleChange = useCallback((keys: Key[]) => {
        const next = keys.map((key) => String(key));
        if (next.includes(ALL_OPTION_KEY)) {
            handleMultiChange([]);
            return;
        }

        handleMultiChange(next);
    }, [handleMultiChange]);

    const triggerLabel = selectedValues.length === 0 ? 'All' : `${selectedValues.length} selected`;

    return (
        <div className='form-field-canvas flex min-h-7 flex-row items-center justify-between gap-2'>
            <span className={cn('canvas-form-label min-w-32 shrink-0', COMPACT_FIELD_LABEL)}>
                Selected Timesteps
            </span>
            <div className='render-input-container relative flex w-full min-w-0 max-w-[150px] items-center justify-end'>
                <Autocomplete
                    className='min-w-0 flex-1'
                    selectionMode='multiple'
                    value={selectedValues}
                    onChange={handleChange}
                    placeholder='All'
                    aria-label='Selected timesteps'
                    fullWidth
                >
                    <Autocomplete.Trigger className={COMPACT_FIELD_TRIGGER}>
                        <Autocomplete.Value className={COMPACT_FIELD_VALUE}>{triggerLabel}</Autocomplete.Value>
                        <Autocomplete.Indicator />
                    </Autocomplete.Trigger>
                    <Autocomplete.Popover className='w-auto min-w-56 max-w-none'>
                        <Autocomplete.Filter>
                            <SearchField autoFocus aria-label='Search timesteps'>
                                <SearchField.Group>
                                    <SearchField.SearchIcon />
                                    <SearchField.Input placeholder='Search timesteps…' />
                                    <SearchField.ClearButton />
                                </SearchField.Group>
                            </SearchField>
                            <ListBox aria-label='Timesteps'>
                                <OptionListBoxItem option={ALL_OPTION} />
                                {options.map((option) => (
                                    <OptionListBoxItem key={option.value} option={option} />
                                ))}
                            </ListBox>
                        </Autocomplete.Filter>
                    </Autocomplete.Popover>
                </Autocomplete>
            </div>
        </div>
    );
};

export default SelectedTimestepsField;
