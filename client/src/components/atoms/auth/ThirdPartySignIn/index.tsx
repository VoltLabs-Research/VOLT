import React from 'react';
import googleLogo from '@/assets/images/google-logo.png';
import microsoftLogo from '@/assets/images/microsoft-logo.png'
import githubLogo from '@/assets/images/github-logo.png';
import './ThirdPartySignIn.css';

const ThirdPartySignIn = () => {
    return(
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

export default ThirdPartySignIn;
