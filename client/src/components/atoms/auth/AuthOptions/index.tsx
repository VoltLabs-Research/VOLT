import React from 'react';
import './AuthOptions.css';

const AuthOptions = () => {
    return (
        <div className='side-image-form-opts-container'>
            <div className='auth-remember-me-container'>
                <input 
                    type='checkbox'
                    checked={true}
                    name='remember-me' />

                <p className='auth-remember-me-text'>Remember me</p>
            </div>

            <a className='auth-forgot-password-link'>Forgot Password?</a>
        </div>
    );
};

export default AuthOptions;