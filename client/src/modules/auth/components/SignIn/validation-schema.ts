import { z } from 'zod';

export interface SignInForm {
    email: string;
    fullName: string;
    password: string;
    passwordConfirm: string;
}

export const signInSchema = z.object({
    email: z
        .string()
        .min(1, 'Email is required')
        .email('Please enter a valid email'),
    fullName: z
        .string()
        .min(1, 'Full name is required'),
    password: z
        .string()
        .min(1, 'Password is required'),
    passwordConfirm: z
        .string()
        .min(1, 'Password confirmation is required')
}).refine((data) => data.passwordConfirm === data.password, {
    message: 'Passwords do not match',
    path: ['passwordConfirm']
});
