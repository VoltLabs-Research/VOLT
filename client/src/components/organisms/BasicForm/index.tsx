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

import React, { useState } from 'react';
import FormInput from '@/components/atoms/form/FormInput';
import Loader from '@/components/atoms/Loader';
import { GoArrowLeft } from 'react-icons/go';
import './BasicForm.css';

const renderInput = (inputProps, formState, handleChange) => {
    if(inputProps.container){
        return (
            <div key={inputProps.id} className={inputProps.container.className}>
                {inputProps.container.children.map(childProps => 
                    renderInput(childProps, formState, handleChange)
                )}
            </div>
        );
    }

    return (
        <FormInput
            key={inputProps.name}
            {...inputProps}
            value={formState[inputProps.name] || ''} 
            onChange={handleChange}
        />
    );
};

const BasicForm = ({
    breadcrumbs,
    title,
    isLoading,
    inputs,
    onSubmit,
    initialState = {},
    disabled = false
}) => {
    const [formState, setFormState] = useState(initialState);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormState(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        onSubmit(formState);
    };

    return (
        <main className='basic-form-container'>
            <form className='basic-form' onSubmit={handleFormSubmit}>
                <div className='basic-form-header-container'>
                    <div className='breadcrumbs-container'>
                        {breadcrumbs.map((breadcrumbName, index) => (
                            <div className='breadcrumb-container' key={index}>
                                <span className='breadcrumb-title'>{breadcrumbName}</span><span className='breadcrumb-sep'>/</span>
                            </div>
                        ))}
                    </div>
                    <h3 className='basic-form-header-title'>{title}</h3>
                </div>

                <div className='basic-form-body-container'>
                    {inputs.map(inputProps => renderInput(inputProps, formState, handleChange))}
                </div>

                <div className='basic-form-footer-container'>
                    {(isLoading) ? (
                        <div className='form-submit-loading-container'>
                            <Loader scale={0.6} />
                        </div>
                    ) : (
                        <button 
                            type='submit'
                            disabled={disabled} 
                            className='form-submit-button-container'
                        >
                            <span className='form-submit-button-title'>Continue</span>
                        </button>
                    )}
                    <p className='auth-agree-text'>By joining, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span></p>
                </div>
            </form>

            <div className='go-back-container'>
                <i className='go-back-arrow-container'>
                    <GoArrowLeft />
                </i>

                <span className='go-back-title'>Go Back</span>
            </div>
        </main>
    );
};

export default BasicForm;