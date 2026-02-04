import React from 'react';
import Container from '@/shared/presentation/components/Container';
import Title from '@/shared/presentation/components/Title';
import Select, { type SelectOption } from '@/shared/presentation/components/Select';
import './FormField.css';

interface FormFieldProps {
    label: string;
    fieldKey: string;
    fieldType: 'input' | 'select' | 'checkbox' | 'color';
    fieldValue: string | number | boolean;
    onFieldChange: (key: string, value: string | number | boolean) => void;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
    options?: SelectOption[];
    isLoading?: boolean;
    suggestions?: Array<string | number>;
    onFetchSuggestions?: () => void;
}

const FormField: React.FC<FormFieldProps> = ({
    label,
    fieldKey,
    fieldType,
    fieldValue,
    onFieldChange,
    inputProps,
    options,
    isLoading = false,
    suggestions,
    onFetchSuggestions
}) => {
    const handleChange = (value: string | number | boolean) => {
        onFieldChange(fieldKey, value);
    };

    const renderInput = () => {
        switch (fieldType) {
            case 'select':
                return (
                    <Select
                        options={options || []}
                        value={String(fieldValue)}
                        onChange={(value) => handleChange(value)}
                        className='labeled-input'
                    />
                );

            case 'checkbox':
                return (
                    <input
                        type='checkbox'
                        checked={Boolean(fieldValue)}
                        onChange={(event) => handleChange(event.target.checked)}
                    />
                );

            case 'color':
                return (
                    <input
                        type='color'
                        value={typeof fieldValue === 'string' ? fieldValue : String(fieldValue)}
                        onChange={(event) => handleChange(event.target.value)}
                        className='labeled-input-color'
                        {...inputProps}
                    />
                );

            case 'input':
            default:
                {
                    const datalistId = suggestions?.length ? `${fieldKey}-suggestions` : undefined;
                    return (
                        <>
                            <input
                                {...inputProps}
                                value={String(fieldValue)}
                                onChange={(event) => handleChange(event.target.value)}
                                onFocus={onFetchSuggestions}
                                list={datalistId}
                                className='labeled-input'
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
        }
    };

    return (
        <Container className={`d-flex content-between items-center ${fieldType === 'checkbox' ? 'checkbox-container' : ''} ${isLoading ? 'form-field-loading' : ''}`}>
            <Title className='font-size-2-5 labeled-input-label font-weight-4'>{label}</Title>
            <Container className='d-flex items-center render-input-container'>
                {renderInput()}
            </Container>
        </Container>
    );
};

export default FormField;
