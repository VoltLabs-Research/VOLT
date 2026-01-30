import { forwardRef, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';
import Container from '@/shared/presentation/components/Container';
import './FormField.css';

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement>{
    label?: string;
    error?: string;
    icon?: ReactNode;
    isLoading?: boolean;
};

const FormField = forwardRef<HTMLInputElement, FormFieldProps>(({ 
    label, 
    error,
    icon,
    isLoading,
    className = '',
    ...props 
}, ref) => {
    const containerClass = isLoading ? 'is-loading' : '';
    const inputClass = [
        'form-field-input w-max',
        error && 'has-error',
        icon && 'has-icon',
        className
    ].filter(Boolean).join(' ');

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
                    className={inputClass}
                    {...props} 
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
