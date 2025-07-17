import React from 'react';
import Input from '../../atoms/Input';
import Select from '../../atoms/Select';
import './FormField.css';

interface FormFieldProps {
    label: string;
    fieldKey: string;
    fieldType: 'input' | 'select' | 'checkbox';
    fieldValue: string | number | boolean; 
    onFieldChange: (key: string, value: any) => void;
    inputProps?: React.InputHTMLAttributes<HTMLInputElement>; 
    options?: string[]; 
}
const FormField: React.FC<FormFieldProps> = ({
    label,
    fieldKey,
    fieldType,
    fieldValue,
    onFieldChange,
    inputProps,
    options
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
                    />
                );

            case 'checkbox':
                const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                    onFieldChange(fieldKey, e.target.checked);
                };
                
                return (
                    <input
                        type="checkbox"
                        checked={Boolean(fieldValue)}
                        onChange={handleCheckboxChange}
                        className='labeled-input-checkbox'
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
        <div className={`labeled-input-container ${fieldType === 'checkbox' ? 'checkbox-container' : ''}`}>
            <h4 className='labeled-input-label'>{label}</h4>
            <div className='labeled-input-tag-container'>
                {renderInput()}
            </div>
        </div>
    );
};

export default FormField;