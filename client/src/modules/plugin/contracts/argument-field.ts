import type { InputHTMLAttributes } from 'react';
import type { FormFieldChangeHandler } from '@/shared/contracts/form-field';
import type { SelectOption } from '@voltstack/bravais';

export interface ArgumentFieldProps {
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
