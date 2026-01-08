/**
 * Copyright(c) 2025, The Volterra Authors. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files(the "Software"), to deal
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
 */

import React from 'react';
import { AlertCircle } from 'lucide-react';
import '@/components/atoms/form/FormInput/FormInput.css';
import Container from '@/components/primitives/Container';
import Title from '@/components/primitives/Title';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    showError?: boolean;
    variant?: 'default' | 'auth'; // 'default' for settings forms, 'auth' for sign-in forms
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
