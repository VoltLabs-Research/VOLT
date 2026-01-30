import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface SignInForm{
    email: string;
    password: string;
    fullName: string;
    passwordConfirm: string;
};

export const signInSchema: ValidationSchema<SignInForm> = {
    email: [
        { required: true, message: 'Email is required' },
        { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email address' }
    ],
    password: {
        required: true,
        minLength: 8,
        maxLength: 16,
        message: 'Password must be between 8 and 16 characters'
    },
    fullName: {
        required: true,
        minLength: 2,
        maxLength: 32,
        validate: (value) => {
            const parts = value?.trim().split(/\s+/) || [];
            return parts.length >= 2 || 'Please enter your first and last name';
        }
    },
    passwordConfirm: {
        required: true,
        validate: (value, formData) => value === formData?.password || 'Passwords do not match'
    }
};
