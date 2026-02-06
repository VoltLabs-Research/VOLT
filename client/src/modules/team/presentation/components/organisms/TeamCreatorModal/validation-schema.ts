import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface TeamCreatorForm{
    name: string;
    description: string;
};

export const teamCreatorSchema: ValidationSchema<TeamCreatorForm> = {
    name: { required: true, message: 'Team name is required' },
    description: {}
};
