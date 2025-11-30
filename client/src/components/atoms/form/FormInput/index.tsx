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
import { AlertCircle } from 'lucide-react';
import './FormInput.css';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    showError?: boolean;
    variant?: 'default' | 'auth'; // 'default' for settings forms, 'auth' for sign-in forms
}

const FormInput: React.FC<FormInputProps> = ({ label, error, showError = true, variant = 'default', className = '', ...props }) => {
    const variantClass = variant === 'auth' ? 'form-input-auth' : '';

    return (
        <div className={`form-input-wrapper-container ${variantClass}`}>
            {label && (
                <label className='form-input-label-container'>
                    <h3 className='form-input-label'>{label}</h3>
                </label>
            )}

            <div className={`form-input-container ${error ? 'form-input-error' : ''} ${variantClass}`}>
                <input className={`form-input ${className}`} {...props} />
            </div>

            {error && showError && (
                <div className="form-error-message">
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default FormInput;