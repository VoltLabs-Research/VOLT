/**
 * Copyright (c) 2025, The Volterra Authors. All rights reserved.
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
 */

import React from 'react';
import './Input.css';

interface InputProps {
    type?: 'text' | 'number' | 'email' | 'password';
    value: string | number;
    onChange: (value: string | number) => void;
    placeholder?: string;
    disabled?: boolean;
    step?: string;
    min?: string | number;
    max?: string | number;
    className?: string;
    autoFocus?: boolean;
    required?: boolean;
}

const Input: React.FC<InputProps> = ({
    type = 'text',
    value,
    onChange,
    placeholder,
    disabled = false,
    step,
    min,
    max,
    className = '',
    autoFocus = false,
    required = false
}) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
        onChange(newValue);
    };

    return (
        <input
            type={type}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
            step={step}
            min={min}
            max={max}
            className={className}
            autoFocus={autoFocus}
            required={required}
        />
    );
};

export default Input;