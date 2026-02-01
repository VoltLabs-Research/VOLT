import { forwardRef, ReactNode, ChangeEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Select from '@/shared/presentation/components/Select';
import { cn } from '@/shared/utils';
import './FormField.css';

export interface SelectOption {
    value: string;
    title: string;
    description?: string;
};

export interface FormFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value'> {
    label?: string;
    fieldType?: 'input' | 'select' | 'checkbox' | 'textarea';
    value?: string | number | boolean;
    error?: string;
    icon?: ReactNode;
    isLoading?: boolean;
    options?: SelectOption[];
    rows?: number;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
    variant?: 'default' | 'inline';
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
    ...restProps
}, ref) => {
    const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        onChange?.(e as ChangeEvent<HTMLInputElement>);
    };

    const handleSelectChange = (selectedValue: string) => {
        const syntheticEvent = {
            target: { name, value: selectedValue }
        } as ChangeEvent<HTMLInputElement>;
        onChange?.(syntheticEvent);
    };

    const handleCheckboxChange = (e: ChangeEvent<HTMLInputElement>) => {
        onChange?.(e);
    };

    // Inline variant (for workflow editors)
    if (variant === 'inline') {
        const renderInlineField = () => {
            switch (fieldType) {
                case 'select':
                    return (
                        <Select
                            options={options}
                            value={String(value ?? '')}
                            onChange={handleSelectChange}
                            placeholder={placeholder}
                            className='form-field-inline-select'
                        />
                    );

                case 'checkbox':
                    return (
                        <input
                            type='checkbox'
                            name={name as string}
                            className='form-field-inline-checkbox'
                            checked={Boolean(value)}
                            onChange={handleCheckboxChange}
                        />
                    );

                case 'textarea':
                    return (
                        <textarea
                            name={name as string}
                            className='form-field-inline-input form-field-inline-textarea'
                            value={String(value ?? '')}
                            onChange={handleInputChange}
                            placeholder={placeholder}
                            rows={rows}
                        />
                    );

                case 'input':
                default:
                    return (
                        <input
                            ref={ref}
                            name={name as string}
                            {...inputProps}
                            className='form-field-inline-input'
                            value={String(value ?? '')}
                            onChange={handleInputChange}
                            placeholder={placeholder}
                        />
                    );
            }
        };

        const isCheckbox = fieldType === 'checkbox';
        const containerClass = isCheckbox
            ? 'form-field-inline form-field-inline-checkbox-container d-flex content-between items-center'
            : 'form-field-inline d-flex content-between items-center gap-1';

        return (
            <Container className={`${containerClass} ${isLoading ? 'is-loading' : ''}`}>
                <Title className='form-field-inline-label font-size-2-5 font-weight-4'>
                    {label}
                </Title>
                <Container className='d-flex items-center' style={{ flex: isCheckbox ? undefined : 1 }}>
                    {renderInlineField()}
                </Container>
            </Container>
        );
    }

    // Default variant (original FormField behavior - vertical layout with spread props)
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
                    name={name as string}
                    className={inputClass}
                    placeholder={placeholder}
                    value={String(value ?? '')}
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
