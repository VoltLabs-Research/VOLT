import Select from '@/shared/presentation/primitives/Select';
import { useMemo, useCallback } from 'react';
import type { SelectOption } from '@/shared/presentation/primitives/Select';

interface FrameComboboxProps {
    value: number | undefined;
    options: number[];
    onChange: (value: number | undefined) => void;
    title?: string;
}

const FrameCombobox = ({ value, options, onChange, title }: FrameComboboxProps) => {
    const selectOptions: SelectOption[] = useMemo(
        () => options.map((n) => ({ value: String(n), title: String(n) })),
        [options]
    );

    const handleChange = useCallback((val: string) => {
        if (val === '') {
            onChange(undefined);
            return;
        }

        const nextValue = Number(val);
        onChange(Number.isFinite(nextValue) ? nextValue : undefined);
    }, [onChange]);

    const normalizedValue = value !== undefined ? String(value) : '';
    const placeholder = value !== undefined ? String(value) : 'No frames';

    return (
        <Select
            isEditable
            options={selectOptions}
            value={normalizedValue}
            onChange={handleChange}
            placeholder={placeholder}
            className='form-field-canvas-input--compact'
            showSelectionIcon={false}
            title={title}
            disabled={options.length === 0}
        />
    );
};

export default FrameCombobox;
