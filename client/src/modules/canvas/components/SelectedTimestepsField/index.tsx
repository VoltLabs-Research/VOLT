import Select from '@/shared/presentation/primitives/Select';
import '@/shared/presentation/components/FormFieldRHF/FormField.css';
import Row from '@/shared/presentation/primitives/Row';
import { useMemo, useCallback } from 'react';
import type { SelectOption } from '@/shared/presentation/primitives/Select';

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
        <Row justify='between' gap='1' className='form-field-canvas'>
            <span className='canvas-form-label'>
                Selected Timesteps
            </span>
            <Row justify='end' width='max' position='relative' className='render-input-container'>
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
            </Row>
        </Row>
    );
};

export default SelectedTimestepsField;
