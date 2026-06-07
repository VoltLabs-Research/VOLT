import type { ChangeEvent, InputHTMLAttributes } from 'react';
import type { FormFieldChangeHandler } from '@/shared/presentation/components/FormFieldRHF/FormFieldRHF.types';
import type { SelectOption } from '@voltstack/bravais';

export type ArgumentFieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;

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
