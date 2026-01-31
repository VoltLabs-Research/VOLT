import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface RoleEditorForm{
    name: string;
};

export const roleEditorSchema: ValidationSchema<RoleEditorForm> = {
    name: {
        required: true,
        minLength: 2,
        maxLength: 50,
        message: 'Role name must be between 2 and 50 characters'
    }
};
