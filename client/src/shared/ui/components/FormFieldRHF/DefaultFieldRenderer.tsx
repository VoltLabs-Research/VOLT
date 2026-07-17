import { LiquidToggle, Select, TextInput, Textarea } from '@voltstack/bravais';
import { AlertCircle } from 'lucide-react';
import { useId } from 'react';
import type { FieldRendererProps } from './FormFieldRHF.types';
import { buildFieldAccessibilityState } from './field-accessibility';

const DefaultFieldRenderer = ({
    field,
    error,
    label,
    fieldType,
    placeholder,
    icon,
    options,
    rows,
    className,
    disabled,
    type,
    autoFocus,
    inputProps
}: FieldRendererProps) => {
    const reactId = useId();
    const {
        labelId,
        errorId,
        fieldId,
        fieldName,
        ariaLabelledBy,
        fieldStatusAriaProps,
        labelTargetId
    } = buildFieldAccessibilityState({
        reactId,
        field,
        label,
        error,
        fieldType,
        inputProps
    });

    const renderField = () => {
        if (fieldType === 'select') {
            return (
                <Select
                    id={fieldId}
                    options={options}
                    value={String(field.value ?? '')}
                    onChange={(value) => field.onChange(value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    aria-labelledby={ariaLabelledBy}
                    {...fieldStatusAriaProps}
                />
            );
        }

        if (fieldType === 'checkbox') {
            return (
                <LiquidToggle
                    id={fieldId}
                    pressed={Boolean(field.value)}
                    onChange={(next) => field.onChange(next)}
                    aria-labelledby={ariaLabelledBy}
                    {...fieldStatusAriaProps}
                />
            );
        }

        if (fieldType === 'color') {
            return (
                <input
                    id={fieldId}
                    type='color'
                    name={fieldName}
                    value={String(field.value ?? '#000000')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    className='labeled-input-color'
                    disabled={disabled}
                    {...fieldStatusAriaProps}
                />
            );
        }

        if (fieldType === 'textarea') {
            return (
                <Textarea
                    ref={field.ref}
                    id={fieldId}
                    name={fieldName}
                    value={String(field.value ?? '')}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    placeholder={placeholder}
                    minRows={rows}
                    autoComplete={inputProps?.autoComplete}
                    inputMode={inputProps?.inputMode}
                    spellCheck={inputProps?.spellCheck}
                    disabled={disabled}
                    hasError={!!error}
                    className={className}
                    {...fieldStatusAriaProps}
                />
            );
        }

        const { size: _size, ...restInputProps } = inputProps ?? {};
        return (
            <TextInput
                ref={field.ref}
                id={fieldId}
                name={fieldName}
                {...restInputProps}
                type={type ?? 'text'}
                value={String(field.value ?? '')}
                onChange={field.onChange}
                onBlur={field.onBlur}
                placeholder={placeholder}
                disabled={disabled}
                autoFocus={autoFocus}
                hasError={!!error}
                fullWidth
                leftIcon={icon}
                className={className}
                {...fieldStatusAriaProps}
            />
        );
    };

    return (
        <div className='form-field-container d-flex column gap-05 w-max'>
            {label && (
                <label
                    id={labelId}
                    htmlFor={labelTargetId}
                    className='font-size-2 font-weight-5 color-secondary'
                >
                    {label}
                </label>
            )}

            <div className='p-relative'>
                {renderField()}
            </div>

            {error && (
                <div id={errorId} role='status' aria-live='polite' aria-atomic='true' className='d-flex items-center gap-025 form-field-error font-size-1'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default DefaultFieldRenderer;
