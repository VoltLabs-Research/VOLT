import React from 'react';
import BasicForm from '../../../components/organisms/BasicForm';
import { useAuthStore } from '../../../stores/authentication';

const SignInPage = () => {
    const { signIn, isLoading } = useAuthStore();

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
        await signIn(formData);
    };
    
    return (
        <article className='sign-in-form-container'>
            <BasicForm
                breadcrumbs={['Authentication', 'Sign in with my cloud ID']}
                title="Create and experiment on a single collaborative platform"
                isLoading={isLoading}
                inputs={formInputs}
                initialState={formInitialState}
                onSubmit={handleSubmit}
            />
        </article>
    );
};

export default SignInPage;