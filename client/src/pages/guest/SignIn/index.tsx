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

import SideImageForm from '@/components/organisms/SideImageForm';
import useAuthStore from '@/stores/authentication';
import googleLogo from '@/assets/images/google-logo.png';
import microsoftLogo from '@/assets/images/microsoft-logo.png'
import githubLogo from '@/assets/images/github-logo.png';
import './SignIn.css';

const ThirdPartySignIn = () => {
    return (
        <>
          <div className='auth-third-party-account-container'>
                <i className='auth-third-party-account-icon-container'>
                    <img src={googleLogo} className='auth-third-party-account-icon' />
                </i>
                <span className='auth-third-party-account-name'>Google</span>
            </div>

            <div className='auth-third-party-account-container'>
                <i className='auth-third-party-account-icon-container'>
                    <img src={microsoftLogo} className='auth-third-party-account-icon' />
                </i>
                <span className='auth-third-party-account-name'>Microsoft</span>
            </div>

            <div className='auth-third-party-account-container'>
                <i className='auth-third-party-account-icon-container'>
                    <img src={githubLogo} className='auth-third-party-account-icon' />
                </i>
                <span className='auth-third-party-account-name'>GitHub</span>
            </div>
        </>
    );
};

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

const SignInPage = () => {
    const { signUp, isLoading } = useAuthStore();

    const formInitialState = {
        email: '',
        password: ''
    };

    const formInputs = [
        {
            name: 'email',
            type: 'email',
            label: 'Email address',
            placeholder: 'you@example.com'
        },
        {
            name: 'password',
            type: 'password',
            label: 'Password'
        }
    ];

    const handleSubmit = async (formData) => {
        if(formData.password !== formData.passwordConfirm){
            return;
        }
        await signUp(formData);
    };
    
    return (
        <SideImageForm
            title='Welcome Back'
            description='Sign in your account'
            headerBtn={{
                title: 'Sign Up',
                to: '/auth/sign-up'
            }}
            FormOpts={AuthOptions}
            BottomExtras={ThirdPartySignIn}
            isLoading={isLoading}
            inputs={formInputs}
            initialState={formInitialState}
            onSubmit={handleSubmit}
        />
    );
};

export default SignInPage;