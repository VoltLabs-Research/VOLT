import { forwardRef, ReactNode, ChangeEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Select, { type SelectOption } from '@/shared/presentation/components/Select';
import LiquidToggle from '@/shared/presentation/components/LiquidToggle';
import { cn } from '@/shared/utils';
import './FormField.css';

export type { SelectOption };

export interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
    label?: string;
    fieldType?: 'input' | 'select' | 'checkbox' | 'textarea' | 'color';
    value?: string | number | boolean;
    error?: string;
    icon?: ReactNode;
    isLoading?: boolean;
    options?: SelectOption[];
    rows?: number;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
    variant?: 'default' | 'inline' | 'canvas';
    // Canvas-style API (alternative)
    fieldKey?: string;
    fieldValue?: string | number | boolean;
    onFieldChange?: (key: string, value: string | number | boolean) => void;
    suggestions?: Array<string | number>;
    onFetchSuggestions?: () => void;
};

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({
    label,
    name,
    fieldType = 'input',
    value,
    onChange,
    error,
    icon,
    isLoading,
    options = [],
    placeholder,
    rows = 3,
    className = '',
    inputProps,
    variant = 'default',
    // Canvas-style API
    fieldKey,
    fieldValue,
    onFieldChange,
    suggestions,
    onFetchSuggestions,
    ...restProps
}, ref) => {
    // Determine which API is being used
    const isCanvasStyle = fieldKey !== undefined && onFieldChange !== undefined;
    const effectiveValue = isCanvasStyle ? fieldValue : value;
    const effectiveName = isCanvasStyle ? fieldKey : name;

    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (isCanvasStyle && fieldKey) {
            onFieldChange!(fieldKey, e.target.value);
        } else {
            onChange?.(e as ChangeEvent<HTMLInputElement>);
        }
    };

    const handleSelectChange = (selectedValue: string) => {
        if (isCanvasStyle && fieldKey) {
            onFieldChange!(fieldKey, selectedValue);
        } else {
            const syntheticEvent = {
                target: { name: effectiveName, value: selectedValue }
            } as ChangeEvent<HTMLInputElement>;
            onChange?.(syntheticEvent);
        }
    };

    const handleColorChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (isCanvasStyle && fieldKey) {
            onFieldChange!(fieldKey, e.target.value);
        } else {
            onChange?.(e);
        }
    };

    // Inline/canvas variants (for workflow editors)
    if (variant === 'inline' || variant === 'canvas' || isCanvasStyle) {
        const datalistId = suggestions?.length ? `${effectiveName}-suggestions` : undefined;
        const isCanvasVariant = variant === 'canvas' || isCanvasStyle;
        const fieldClass = isCanvasVariant ? 'form-field-canvas-input' : 'form-field-inline-input';
        const selectClass = isCanvasVariant ? 'form-field-canvas-select' : 'form-field-inline-select';
        const textareaClass = isCanvasVariant ? 'form-field-canvas-textarea' : 'form-field-inline-textarea';
        const containerBaseClass = isCanvasVariant ? 'form-field-canvas' : 'form-field-inline';

        const renderInlineField = () => {
            switch (fieldType) {
                case 'select':
                    return (
                        <Select
                            options={options}
                            value={String(effectiveValue ?? '')}
                            onChange={handleSelectChange}
                            placeholder={placeholder}
                            className={`${selectClass} labeled-input`}
                        />
                    );

                case 'checkbox':
                    return (
                        <LiquidToggle
                            pressed={Boolean(effectiveValue)}
                            onChange={(next) => {
                                if (isCanvasStyle && fieldKey) {
                                    onFieldChange!(fieldKey, next);
                                } else {
                                    const syntheticEvent = {
                                        target: { name: effectiveName, checked: next }
                                    } as ChangeEvent<HTMLInputElement>;
                                    onChange?.(syntheticEvent);
                                }
                            }}
                        />
                    );

                case 'color':
                    return (
                        <input
                            type='color'
                            value={typeof effectiveValue === 'string' ? effectiveValue : String(effectiveValue)}
                            onChange={handleColorChange}
                            className='labeled-input-color'
                            {...inputProps}
                        />
                    );

                case 'textarea':
                    return (
                        <textarea
                            name={effectiveName as string}
                            className={`${fieldClass} ${textareaClass}`}
                            value={String(effectiveValue ?? '')}
                            onChange={handleInputChange}
                            placeholder={placeholder}
                            rows={rows}
                        />
                    );

                case 'input':
                default:
                    return (
                        <>
                            <input
                                ref={ref}
                                name={effectiveName as string}
                                {...inputProps}
                                className={`${fieldClass} labeled-input`}
                                value={String(effectiveValue ?? '')}
                                onChange={handleInputChange}
                                placeholder={placeholder}
                                list={datalistId}
                                onFocus={onFetchSuggestions}
                            />
                            {datalistId && suggestions && (
                                <datalist id={datalistId}>
                                    {suggestions.map((option) => (
                                        <option key={String(option)} value={String(option)} />
                                    ))}
                                </datalist>
                            )}
                        </>
                    );
            }
        };

        const isCheckbox = fieldType === 'checkbox';
        const containerClass = isCheckbox
            ? `${containerBaseClass} form-field-inline-checkbox-container d-flex content-between items-center checkbox-container`
            : `${containerBaseClass} d-flex content-between items-center gap-1`;

        const labelClass = isCanvasVariant
            ? 'canvas-form-label'
            : 'form-field-inline-label font-size-2-5 font-weight-4 labeled-input-label';

        return (
            <Container className={`${containerClass} ${isLoading ? 'is-loading form-field-loading' : ''}`}>
                <span className={labelClass}>{label}</span>
                <Container className='d-flex items-center render-input-container' style={{ flex: isCheckbox ? undefined : 1 }}>
                    {renderInlineField()}
                </Container>
            </Container>
        );
    }

    // Default variant (vertical layout with spread props)
    const containerClass = isLoading ? 'is-loading' : '';
    const inputClass = cn(
        'form-field-input radius-sm w-max',
        error && 'has-error',
        !!icon && 'has-icon',
        className
    );

    return (
        <Container className={`form-field-container d-flex column gap-05 w-max ${containerClass}`}>
            {label && (
                <label className='font-size-2 font-weight-5 color-secondary'>
                    {label}
                </label>
            )}

            <Container className='p-relative'>
                <input
                    ref={ref}
                    name={effectiveName as string}
                    className={inputClass}
                    placeholder={placeholder}
                    value={String(effectiveValue ?? '')}
                    onChange={handleInputChange}
                    {...restProps}
                />
                {icon && (
                    <Container className='form-field-icon p-absolute d-flex flex-center'>
                        {icon}
                    </Container>
                )}
            </Container>

            {error && (
                <Container className='d-flex items-center gap-025 form-field-error font-size-1'>
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </Container>
            )}
        </Container>
    );
});

FormField.displayName = 'FormField';

export default FormField;
