import type { FieldRendererProps, FieldStatusAriaProps } from './FormFieldRHF.types';

interface BuildFieldAccessibilityStateInput {
    reactId: string;
    field: FieldRendererProps['field'];
    label: FieldRendererProps['label'];
    error: FieldRendererProps['error'];
    fieldType: FieldRendererProps['fieldType'];
    inputProps: FieldRendererProps['inputProps'];
}

export interface FieldAccessibilityState {
    labelId: string;
    errorId: string;
    fieldId: string;
    fieldName: string;
    ariaLabelledBy: string | undefined;
    fieldStatusAriaProps: FieldStatusAriaProps;
    labelTargetId: string | undefined;
}

export const buildFieldAccessibilityState = ({
    reactId,
    field,
    label,
    error,
    fieldType,
    inputProps
}: BuildFieldAccessibilityStateInput): FieldAccessibilityState => {
    const baseId = `${field.name || 'field'}-${reactId}`;
    const labelId = `${baseId}-label`;
    const errorId = `${baseId}-error`;
    const fieldId = inputProps?.id ?? `${baseId}-control`;
    const fieldName = inputProps?.name ?? field.name;
    const describedBy = [inputProps?.['aria-describedby'], error ? errorId : undefined]
        .filter((value): value is string => Boolean(value?.trim()))
        .join(' ') || undefined;
    const ariaLabelledBy = label ? labelId : undefined;
    const fieldStatusAriaProps: FieldStatusAriaProps = {
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-errormessage': error ? errorId : undefined
    };
    const labelTargetId = fieldType === 'input' || fieldType === 'textarea' || fieldType === 'color'
        ? fieldId
        : undefined;

    return {
        labelId,
        errorId,
        fieldId,
        fieldName,
        ariaLabelledBy,
        fieldStatusAriaProps,
        labelTargetId
    };
};
