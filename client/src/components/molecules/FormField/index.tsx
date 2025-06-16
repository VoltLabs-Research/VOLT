import React from 'react';
import Input from '../../atoms/Input';
import Select from '../../atoms/Select';

interface FormFieldProps {
    label: string;
    fieldKey: string;
    inputProps?: any;
    field: any;
    onFieldChange: (key: string, value: any) => void;
}

const FormField: React.FC<FormFieldProps> = ({
    label,
    fieldKey,
    inputProps,
    field,
    onFieldChange
}) => {
    const renderInput = () => {
        if (inputProps.type === 'select') {
            return (
                <Select
                    options={inputProps.options || []}
                    value={field[fieldKey] || ''}
                    onChange={(value) => onFieldChange(fieldKey, value)}
                    className='labeled-input'
                />
            );
        }

        return (
            <Input
                {...inputProps}
                value={field[fieldKey] || ''}
                onChange={(value) => onFieldChange(fieldKey, 
                    inputProps.type === 'number' ? parseFloat(value as string) || 0 : value
                )}
                className='labeled-input'
            />
        );
    };

    return (
        <div className='labeled-input-container'>
            <h4 className='labeled-input-label'>{label}</h4>
            <div className='labeled-input-tag-container'>
                {renderInput()}
            </div>
        </div>
    );
};

export default FormField;