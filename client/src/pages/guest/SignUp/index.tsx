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

import BasicForm from '@/components/organisms/BasicForm';
import useAuthStore from '@/stores/authentication';

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