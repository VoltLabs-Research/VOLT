import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface TeamInviteForm{
    email: string;
};

export const teamInviteSchema: ValidationSchema<TeamInviteForm> = {
    email: { required: true, message: 'Email is required' }
};
