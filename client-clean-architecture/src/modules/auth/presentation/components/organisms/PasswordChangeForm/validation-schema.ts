import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface PasswordInfo {
    hasPassword: boolean;
    lastChanged?: string;
};

export interface PasswordChangeForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
};

export const passwordChangeSchema: ValidationSchema<PasswordChangeForm> = {
    currentPassword: {
        minLength: 1,
        message: 'Current password is required'
    },
    newPassword: {
        required: true,
        minLength: 8,
        maxLength: 128,
        message: 'Password must be at least 8 characters'
    },
    confirmPassword: {
        required: true,
        validate: (value, formData) => value === formData?.newPassword || 'Passwords do not match'
    }
};
