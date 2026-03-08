import { z } from 'zod';

const baseSchema = z.object({
    name: z.string().min(1, 'Connection name is required'),
    host: z.string().min(1, 'Host is required'),
    port: z.string()
        .min(1, 'Port is required')
        .refine((value) => {
            const port = parseInt(value);
            return !isNaN(port) && port > 0 && port <= 65535;
        }, 'Port must be between 1 and 65535'),
    username: z.string().min(1, 'Username is required'),
    password: z.string()
});

export const createSSHConnectionSchema = (mode: 'create' | 'edit') => {
    if (mode === 'create') {
        return baseSchema.extend({
            password: z.string().min(1, 'Password is required')
        }).strict();
    }
    return baseSchema.strict();
};

export type SSHConnectionFormData = z.infer<typeof baseSchema>;

export const defaultValues: SSHConnectionFormData = {
    name: '',
    host: '',
    port: '22',
    username: '',
    password: ''
};
