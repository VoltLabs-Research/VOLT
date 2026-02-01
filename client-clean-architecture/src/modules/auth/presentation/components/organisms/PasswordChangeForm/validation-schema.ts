import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export type { GetPasswordInfoOutputDTO as PasswordInfo } from '@/modules/auth/application/dtos';

export interface PasswordChangeForm {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
};

export const passwordChangeSchema: ValidationSchema<PasswordChangeForm> = {
    currentPassword: { required: true, message: 'Current password is required' },
    newPassword: { required: true, message: 'New password is required' },
    confirmPassword: {
        required: true,
        validate: (value, formData) => value === formData?.newPassword || 'Passwords do not match'
    }
};
