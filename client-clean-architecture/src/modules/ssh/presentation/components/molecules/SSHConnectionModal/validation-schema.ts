import { ValidationSchema } from '@/shared/presentation/hooks/use-form-validation';

export interface SSHConnectionFormData {
    name: string;
    host: string;
    port: string;
    username: string;
    password: string;
};

export const defaultValues: SSHConnectionFormData = {
    name: '',
    host: '',
    port: '22',
    username: '',
    password: ''
};

export const createSSHConnectionSchema = (mode: 'create' | 'edit'): ValidationSchema<SSHConnectionFormData> => ({
    name: { required: true, message: 'Connection name is required' },
    host: { required: true, message: 'Host is required' },
    port: {
        required: true,
        validate: (value) => {
            const port = parseInt(value);
            return !isNaN(port) && port > 0 && port <= 65535;
        },
        message: 'Port must be between 1 and 65535'
    },
    username: { required: true, message: 'Username is required' },
    password: mode === 'create'
        ? { required: true, message: 'Password is required' }
        : undefined
});
