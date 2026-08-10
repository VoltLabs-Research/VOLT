import { Autocomplete, Label, ListBox, SearchField } from '@heroui/react';
import { useMemo, useCallback } from 'react';

import type { Key } from 'react';
import type { SelectOption } from '@/modules/canvas/contracts/select-option';

interface SelectedTimestepsFieldProps {
    availableTimesteps: number[];
    selectedTimesteps?: number[];
    onChange: (selectedTimesteps?: number[]) => void;
}

/**
 * bravais's `allOption` was not a selectable value: picking it called
 * `onMultiChange([])`, which this field maps back to `undefined` — "every timestep".
 * The key is kept out of `selectedValues` so it never renders as selected, exactly as
 * before.
 */
const ALL_OPTION_KEY = '__all__';

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

    /*
     * This field borrowed FormFieldRHF's canvas-surface classes by importing its
     * stylesheet across module boundaries. That sheet is gone; the utilities below
     * are the same rules it provided, copied from `FormFieldRHF/field-styles.ts`
     * (canvas surface). The class names stay as markers because `RightPanel`'s plugin
     * config view still re-expresses its mobile layout as descendant variants over
     * `.form-field-canvas`, `.canvas-form-label` and `.render-input-container`.
     *
     * Note `gap-2`, not the `gap-4` that was here: the old unlayered
     * `.form-field-canvas { gap: .5rem }` outranked the utility, so 0.5rem is what
     * actually rendered.
     *
     * The control is an `Autocomplete` rather than a `Select` because bravais's
     * `isMulti` + `hasSearch` needs both multiple selection and a text filter;
     * `Autocomplete`'s root IS a RAC Select, and `Autocomplete.Filter` is the filter
     * provider `hasSearch` was.
     */
    return (
        <div className='form-field-canvas flex min-h-6 flex-row items-center justify-between gap-2'>
            <span className='canvas-form-label min-w-[130px] shrink-0 overflow-hidden text-ellipsis whitespace-nowrap text-[0.7rem] leading-6 tracking-[0.01em] text-muted'>
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
                    <Autocomplete.Trigger className='h-6 min-h-6 rounded-lg px-[0.4rem] text-[0.7rem]'>
                        <Autocomplete.Value className='truncate text-[0.7rem]'>{triggerLabel}</Autocomplete.Value>
                        <Autocomplete.Indicator />
                    </Autocomplete.Trigger>

                    <Autocomplete.Popover>
                        <Autocomplete.Filter>
                            <SearchField autoFocus aria-label='Search timesteps'>
                                <SearchField.Group>
                                    <SearchField.SearchIcon />
                                    <SearchField.Input placeholder='Search timesteps...' />
                                    <SearchField.ClearButton />
                                </SearchField.Group>
                            </SearchField>

                            <ListBox aria-label='Timesteps'>
                                <ListBox.Item id={ALL_OPTION_KEY} textValue='All'>
                                    <ListBox.ItemIndicator />
                                    <Label>All</Label>
                                </ListBox.Item>
                                {options.map((option) => (
                                    <ListBox.Item key={option.value} id={option.value} textValue={option.title}>
                                        <ListBox.ItemIndicator />
                                        <Label>{option.title}</Label>
                                    </ListBox.Item>
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
