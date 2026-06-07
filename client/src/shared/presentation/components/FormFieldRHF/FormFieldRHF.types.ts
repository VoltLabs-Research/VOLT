import type { SelectOption } from '@voltstack/bravais';
import type { ChangeEvent, InputHTMLAttributes, ReactNode, RefCallback } from 'react';
import type { Control, FieldValues, Path } from 'react-hook-form';

export interface SyntheticInputTarget {
    name: string;
    value: string;
};

export interface SyntheticChangeEvent {
    target: SyntheticInputTarget;
    currentTarget: SyntheticInputTarget;
};

export type FormFieldChangeEvent = ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | SyntheticChangeEvent;
export type FormFieldChangeHandler = {
    bivarianceHack(event: FormFieldChangeEvent): void;
}['bivarianceHack'];

export interface FormFieldAutocompleteOption {
    value: string;
    label?: string;
};

export interface FormFieldAutocompleteConfig {
    trigger?: string;
    options: Array<string | number | FormFieldAutocompleteOption>;
    maxItems?: number;
};

interface SharedFieldProps {
    label?: string;
    fieldType?: 'input' | 'select' | 'checkbox' | 'textarea' | 'color';
    placeholder?: string;
    icon?: ReactNode;
    options?: SelectOption[];
    rows?: number;
    className?: string;
    disabled?: boolean;
    type?: string;
    autoFocus?: boolean;
    variant?: 'default' | 'inline' | 'canvas';
    suggestions?: Array<string | number>;
    onFetchSuggestions?: () => void;
    autocomplete?: FormFieldAutocompleteConfig;
    inputProps?: InputHTMLAttributes<HTMLInputElement>;
    isLoading?: boolean;
    error?: string;
};

export interface ControlledProps<TForm extends FieldValues> extends SharedFieldProps {
    name: Path<TForm>;
    control: Control<TForm>;
    value?: never;
    onChange?: never;
    onBlur?: never;
    fieldKey?: never;
    fieldValue?: never;
    onFieldChange?: never;
};

export interface UncontrolledProps extends SharedFieldProps {
    name?: string;
    control?: never;
    value?: string | number | boolean;
    onChange?: FormFieldChangeHandler;
    onBlur?: () => void;
    fieldKey?: never;
    fieldValue?: never;
    onFieldChange?: never;
};

export interface CanvasStyleProps extends SharedFieldProps {
    name?: never;
    control?: never;
    value?: never;
    onChange?: never;
    onBlur?: never;
    fieldKey: string;
    fieldValue: string | number | boolean;
    onFieldChange: (key: string, value: string | number | boolean) => void;
};

export type FormFieldRHFProps<TForm extends FieldValues = FieldValues> =
    | ControlledProps<TForm>
    | UncontrolledProps
    | CanvasStyleProps;

export interface ControllerField {
    value: unknown;
    onChange: (...args: unknown[]) => void;
    onBlur: () => void;
    name: string;
    ref: RefCallback<HTMLInputElement | HTMLTextAreaElement>;
};

export interface FieldStatusAriaProps {
    'aria-describedby': string | undefined;
    'aria-invalid': true | undefined;
    'aria-errormessage': string | undefined;
};

export interface FieldRendererProps {
    field: ControllerField;
    error?: string;
    label?: string;
    fieldType: 'input' | 'select' | 'checkbox' | 'textarea' | 'color';
    placeholder?: string;
    icon?: ReactNode;
    options: SelectOption[];
    rows: number;
    className: string;
    disabled: boolean;
    type?: string;
    autoFocus: boolean;
    variant: 'default' | 'inline' | 'canvas';
    suggestions?: Array<string | number>;
    onFetchSuggestions?: () => void;
    autocomplete?: FormFieldAutocompleteConfig;
    inputProps?: InputHTMLAttributes<HTMLInputElement>;
    isLoading: boolean;
};
