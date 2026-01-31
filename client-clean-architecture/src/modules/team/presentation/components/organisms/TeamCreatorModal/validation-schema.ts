import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface TeamCreatorForm{
    name: string;
    description: string;
};

export const teamCreatorSchema: ValidationSchema<TeamCreatorForm> = {
    name: {
        required: true,
        minLength: 3,
        maxLength: 50,
        message: 'Team name must be between 3 and 50 characters'
    },
    description: {
        maxLength: 250,
        message: 'Description cannot exceed 250 characters'
    }
};
