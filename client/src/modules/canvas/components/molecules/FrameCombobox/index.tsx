import Select from '@/shared/presentation/components/Select';
import { useMemo, useCallback } from 'react';
import type { SelectOption } from '@/shared/presentation/components/Select';

interface FrameComboboxProps {
    value: number;
    options: number[];
    onChange: (value: number) => void;
    title?: string;
};

const FrameCombobox = ({ value, options, onChange, title }: FrameComboboxProps) => {
    const selectOptions: SelectOption[] = useMemo(
        () => options.map((n) => ({ value: String(n), title: String(n) })),
        [options]
    );

    const handleChange = useCallback((val: string) => {
        onChange(Number(val));
    }, [onChange]);

    return (
        <Select
            isEditable
            options={selectOptions}
            value={String(value)}
            onChange={handleChange}
            placeholder={String(value)}
            className='form-field-canvas-input--compact'
            showSelectionIcon={false}
            title={title}
        />
    );
};

export default FrameCombobox;
