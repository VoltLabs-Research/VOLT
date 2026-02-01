import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface ProfileForm {
    fullName: string;
    email: string;
};

export const profileSchema: ValidationSchema<ProfileForm> = {
    fullName: { required: true, message: 'Full name is required' },
    email: { required: true, message: 'Email is required' }
};
