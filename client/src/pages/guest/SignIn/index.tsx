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