/**
* Copyright (C) Rodolfo Herrera Hernandez. All rights reserved.
*
* Permission is hereby granted, free of charge, to any person obtaining a copy
* of this software and associated documentation files (the "Software"), to deal
* in the Software without restriction, including without limitation the rights
* to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the Software is
* furnished to do so, subject to the following conditions:
*
* The above copyright notice and this permission notice shall be included in all
* copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
* IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
* FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
* AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
* LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
* OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
* SOFTWARE.
**/

import React from 'react';
import Input from '@/components/atoms/Input';
import Select from '@/components/atoms/Select';
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