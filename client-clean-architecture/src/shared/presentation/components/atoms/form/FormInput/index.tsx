import React from 'react';
import { AlertCircle } from 'lucide-react';
import '@/shared/presentation/components/atoms/form/FormInput/FormInput.css';
import Container from '@/shared/presentation/components/primitives/Container';
import Title from '@/shared/presentation/components/primitives/Title';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    showError?: boolean;
    variant?: 'default' | 'auth';
}

const FormInput: React.FC<FormInputProps> = ({ label, error, showError = true, variant = 'default', className = '', ...props }) => {
    const variantClass = variant === 'auth' ? 'form-input-auth' : '';

    return (
        <Container className={`d-flex w-max column gap-05 form-input-wrapper-container ${variantClass}`}>
            {label && (
                <label>
                    <Title className='font-weight-4 text-secondary form-input-label color-secondary'>{label}</Title>
                </label>
            )}

            <Container className={`form-input-container ${error ? 'form-input-error' : ''} ${variantClass} w-max`}>
                <input className={`form-input ${className} w-max h-max font-size-2-5 p-1`} {...props} />
            </Container>

            {error && showError && (
                <Container className="d-flex items-center gap-025 form-error-message font-size-1">
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </Container>
            )}
        </Container>
    );
};

export default FormInput;
