import React from 'react';
import { GoArrowLeft } from 'react-icons/go';
import FormInput from '../../../components/atoms/FormInput';
import Loader from '../../../components/atoms/Loader';
import './SignUp.css';

const SignUpPage = () => {

    return (
        <main className='sign-in-main'>
            <section className='sign-in-body-container'>
                <article className='sign-in-body-header-container'>
                    <div className='breadcrumbs-container'>
                        {['Authentication', 'Create new Cloud ID'].map((breadcrumbName, index) => (
                            <div className='breadcrumb-container' key={index}>
                                <span className='breadcrumb-title'>{breadcrumbName}</span><span className='breadcrumb-sep'>/</span>
                            </div>
                        ))}
                    </div>

                    <h3 className='sign-in-body-header-title'>The start of something big is just a sign-up away.</h3>
                </article>
                
                <article className='sign-in-form-container'>
                    <FormInput label='Email address' />
                    <div className='sign-in-fullname-container'>
                        <FormInput label='First name' />
                        <FormInput label='Last name' />
                    </div>
                    <FormInput label='Password' />
                    <FormInput label='Confirm Password' />
                </article>
                        
                <article className='sign-in-form-footer-container'>
                    {(false) ? (
                        <div className='form-submit-loading-container'>
                            <Loader scale={0.6} />
                        </div>
                    ) : (
                        <button disabled={false} className='form-submit-button-container'>
                            <span className='form-submit-button-title'>Continue</span>
                        </button>
                    )}
                    <p className='auth-agree-text'>By joining, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span></p>
                </article>
            </section>


            <div className='go-back-container'>
                <i className='go-back-arrow-container'>
                    <GoArrowLeft />
                </i>

                <span className='go-back-title'>Go Back</span>
            </div>
        </main>
    );
};

export default SignUpPage;