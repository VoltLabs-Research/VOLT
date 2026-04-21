import Select from '@/shared/presentation/components/Select';
import '@/shared/presentation/components/FormFieldRHF/FormField.css';
import { useMemo, useCallback } from 'react';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface SelectedTimestepsFieldProps {
    availableTimesteps: number[];
    selectedTimesteps?: number[];
    onChange: (selectedTimesteps?: number[]) => void;
};

const SelectedTimestepsField = ({
    availableTimesteps,
    selectedTimesteps,
    onChange
}: SelectedTimestepsFieldProps) => {
    const options: SelectOption[] = useMemo(
        () => availableTimesteps.map((t) => ({ value: String(t), title: String(t) })),
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

    return (
        <div className='volt-container form-field-canvas d-flex content-between items-center gap-1'>
            <span className='canvas-form-label'>
                Selected Timesteps
            </span>
            <div className='volt-container d-flex items-center render-input-container w-max content-end p-relative'>
                <Select
                    isMulti
                    options={options}
                    selectedValues={selectedValues}
                    onMultiChange={handleMultiChange}
                    allOption={{ value: '__all__', title: 'All' }}
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
