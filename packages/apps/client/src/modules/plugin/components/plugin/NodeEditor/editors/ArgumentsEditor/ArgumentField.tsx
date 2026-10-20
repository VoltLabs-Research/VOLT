import FormFieldRHF from '@/shared/ui/components/FormFieldRHF';
import type { InputHTMLAttributes } from 'react';
import type { FormFieldChangeHandler } from '@/shared/contracts/form-field';
import type { SelectOption } from '@/modules/plugin/contracts/select-option';

interface ArgumentFieldProps {
    label: string;
    name: string;
    fieldType?: 'input' | 'select' | 'checkbox' | 'textarea';
    value?: string | number | boolean;
    onChange?: FormFieldChangeHandler;
    options?: SelectOption[];
    placeholder?: string;
    inputProps?: InputHTMLAttributes<HTMLInputElement>;
    rows?: number;
}

const ArgumentField = (props: ArgumentFieldProps) => (
    <FormFieldRHF {...props} variant='inline' />
);

export default ArgumentField;
