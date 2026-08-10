import { Select } from '@voltstack/bravais';
import type { SelectOption } from '@voltstack/bravais';
import { useMemo, useCallback } from 'react';

interface SelectedTimestepsFieldProps {
    availableTimesteps: number[];
    selectedTimesteps?: number[];
    onChange: (selectedTimesteps?: number[]) => void;
}

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

    const renderTriggerLabel = useCallback((count: number) => {
        return count === 0 ? 'All' : `${count} selected`;
    }, []);

    /*
     * This field borrowed FormFieldRHF's canvas-surface classes by importing its
     * stylesheet across module boundaries. That sheet is gone; the utilities below
     * are the same rules it provided, copied from `FormFieldRHF/field-styles.ts`
     * (canvas surface). The class names stay as markers because `RightPanel.css`
     * still selects `.form-field-canvas` and `.canvas-form-label` for its mobile
     * layout.
     *
     * Note `gap-2`, not the `gap-4` that was here: the old unlayered
     * `.form-field-canvas { gap: .5rem }` outranked the utility, so 0.5rem is what
     * actually rendered.
     */
    return (
        <div className='flex flex-row items-center justify-between gap-2 min-h-6 form-field-canvas'>
            <span className='min-w-[130px] shrink-0 text-[0.7rem] text-muted whitespace-nowrap overflow-hidden text-ellipsis leading-6 tracking-[0.01em] canvas-form-label'>
                Selected Timesteps
            </span>
            <div className='flex items-center justify-end relative w-full min-w-0 max-w-[150px] render-input-container'>
                <Select
                    isMulti
                    options={options}
                    selectedValues={selectedValues}
                    onMultiChange={handleMultiChange}
                    allOption={{
                        value: '__all__',
                        title: 'All'
                    }}
                    renderTriggerLabel={renderTriggerLabel}
                    hasSearch
                    searchPlaceholder='Search timesteps...'
                    placeholder='All'
                    className='form-field-canvas-select labeled-input'
                />
            </div>
        </div>
    );
};

export default SelectedTimestepsField;
