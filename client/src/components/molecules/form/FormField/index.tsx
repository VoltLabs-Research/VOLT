import React from 'react';
import Input from '@/components/atoms/form/Input';
import Select, { type SelectOption } from '@/components/atoms/form/Select';
import LiquidToggle from '@/components/atoms/form/LiquidToggle';
import './FormField.css';

interface FormFieldProps {
    label: string;
    fieldKey: string;
    fieldType: 'input' | 'select' | 'checkbox' | 'color';
    fieldValue: string | number | boolean;
    onFieldChange: (key: string, value: any) => void;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
    options?: SelectOption[];
    isLoading?: boolean;
    renderInPortal?: boolean;
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
    renderInPortal = false
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
                        onChange={handleChange}
                        className='labeled-input'
                        renderInPortal={renderInPortal}
                    />
                );

            case 'checkbox':
                return (
                    <LiquidToggle
                        pressed={Boolean(fieldValue)}
                        onChange={(next) => onFieldChange(fieldKey, next)}
                    />
                );

            case 'color':
                return (
                    <input
                        type="color"
                        value={typeof fieldValue === 'string' ? fieldValue : String(fieldValue)}
                        onChange={(e) => handleChange(e.target.value)}
                        className='labeled-input-color'
                        {...inputProps}
                    />
                );

            case 'input':
            default:
                return (
                    <Input
                        {...inputProps}
                        value={String(fieldValue)}
                        onChange={handleChange}
                        className='labeled-input'
                    />
                );
        }
    };

    return (
        <div className={`labeled-input-container ${fieldType === 'checkbox' ? 'checkbox-container' : ''} ${isLoading ? 'is-loading' : ''}`}>
            <h4 className='labeled-input-label'>{label}</h4>
            <div className='labeled-input-tag-container'>
                {renderInput()}
            </div>
        </div>
    );
};

export default FormField;
