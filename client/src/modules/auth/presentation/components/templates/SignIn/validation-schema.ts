import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface SignInForm{
    email: string;
    password: string;
    fullName: string;
    passwordConfirm: string;
};

export const signInSchema: ValidationSchema<SignInForm> = {
    email: { required: true, message: 'Email is required' },
    password: { required: true, message: 'Password is required' },
    fullName: { required: true, message: 'Full name is required' },
    passwordConfirm: {
        required: true,
        validate: (value, formData) => value === formData?.password || 'Passwords do not match'
    }
};
