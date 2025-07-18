import React from 'react';
import BasicForm from '../../../components/organisms/BasicForm';
import { useAuthStore } from '../../../stores/authentication';

const SignUpPage = () => {
    const { signUp, isLoading } = useAuthStore();

    const formInitialState = {
        email: '',
        firstName: '',
        lastName: '',
        password: '',
        passwordConfirm: ''
    };

    const formInputs = [
        {
            name: 'email',
            type: 'email',
            label: 'Email address',
            placeholder: 'you@example.com'
        },
        {
            id: 'fullname-container',
            container: {
                className: 'sign-in-fullname-container',
                children: [
                    {
                        name: 'firstName',
                        type: 'text',
                        label: 'First name',
                        placeholder: 'John'
                    },
                    {
                        name: 'lastName',
                        type: 'text',
                        label: 'Last name',
                        placeholder: 'Doe'
                    }
                ]
            }
        },
        {
            name: 'password',
            type: 'password',
            label: 'Password'
        },
        {
            name: 'passwordConfirm',
            type: 'password',
            label: 'Confirm Password'
        }
    ];

    const handleSubmit = async (formData) => {
        if(formData.password !== formData.passwordConfirm){
            return;
        }
        await signUp(formData);
    };
    
    return (
        <article className='sign-in-form-container'>
            <BasicForm
                breadcrumbs={['Authentication', 'Create new Cloud ID']}
                title="The start of something big is just a sign-up away"
                isLoading={isLoading}
                inputs={formInputs}
                initialState={formInitialState}
                onSubmit={handleSubmit}
            />
        </article>
    );
};

export default SignUpPage;