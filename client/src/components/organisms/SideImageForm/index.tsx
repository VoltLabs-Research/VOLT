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

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import signInImage from '@/assets/images/sign-in.png';
import FormInput from '@/components/atoms/form/FormInput';
import Loader from '@/components/atoms/Loader';
import './SideImageForm.css';

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

const SideImageForm = ({
    title,
    description,
    headerBtn,
    isLoading,
    inputs,
    onSubmit,
    FormOpts = null,
    BottomExtras = null,
    initialState = {},
    disabled = false
}) => {
    const [formState, setFormState] = useState(initialState);
    const navigate = useNavigate();
    
    const rightContainerRef = useRef<HTMLDivElement | null>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const el = rightContainerRef.current;
        if(!el) return;

        const checkOverflow = () => {
            const overflow = el.scrollHeight > el.clientHeight;
            setIsOverflowing(overflow);
        };

        const ro = new (window as any).ResizeObserver(() => checkOverflow());
        if(ro) ro.observe(el);

        const mo = new MutationObserver(() => checkOverflow());
        mo.observe(el, { childList: true, subtree: true, characterData: true });

        checkOverflow();
        window.addEventListener('resize', checkOverflow);

        return () => {
            if(ro) ro.disconnect();
            mo.disconnect();
            window.removeEventListener('resize', checkOverflow);
        };
    }, [inputs]);

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormState((prevState) => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        onSubmit(formState);
    };

    return (
        <form className='side-image-form' onSubmit={handleFormSubmit}>
            <button
                type='submit'
                className='button auth-sign-up-button'
                onClick={() => navigate(headerBtn.to)}
            >
                <span className='button-text'>{headerBtn.title}</span>
            </button>

            <figure className='side-image-form-left-container'>
                <img src={signInImage} className='side-image-form-image' />
            </figure>

            <div
                ref={rightContainerRef}
                className={
                    'side-image-form-right-container ' +
                    (isOverflowing ? 'justify-start' : 'justify-center')
                }
            >
                <div className='side-image-form-header-container'>
                    <h3 className='side-image-form-header-title'>{title}</h3>
                    <p className='side-image-form-header-description'>{description}</p>
                </div>

                <div className='side-image-form-body-container'>
                    {inputs.map((inputProps: any) => renderInput(inputProps, formState, handleChange))}

                    {FormOpts && <FormOpts />}

                    <div className='side-image-form-submit-btn-container'>
                        <button
                            type='submit'
                            className={'button sm-radius '.concat((isLoading) ? 'is-loading' : '')}
                        >
                            {isLoading ? (
                                <div className='side-image-form-submit-loader-container'>
                                    <Loader scale={0.6} />
                                </div>
                            ) : (
                                <span className='button-text'>Continue</span>
                            )}
                        </button>
                        <p className='auth-agree-text'>By joining, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span></p>
                    </div>
                </div>

                <div className='side-image-form-footer-container'>
                    {BottomExtras && <BottomExtras />}
                </div>
            </div>
        </form>
    );
};

export default SideImageForm;