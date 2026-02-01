import FormField from '@/shared/presentation/components/FormField';
import type { FieldBind } from '@/shared/presentation/hooks/use-form';
import type { SSHConnectionFormData } from '@/modules/ssh/presentation/components/molecules/SSHConnectionModal/validation-schema';

interface SSHConnectionFormProps {
    field: <K extends keyof SSHConnectionFormData>(name: K) => FieldBind<SSHConnectionFormData, K>;
    mode: 'create' | 'edit';
};

const SSHConnectionForm = ({ field, mode }: SSHConnectionFormProps) => (
    <>
        <FormField
            label='Connection Name'
            placeholder='e.g., Production Server'
            {...field('name')}
        />

        <FormField
            label='Host'
            placeholder='hostname or IP address'
            {...field('host')}
        />

        <FormField
            label='Port'
            type='number'
            placeholder='22'
            {...field('port')}
        />

        <FormField
            label='Username'
            placeholder='SSH username'
            {...field('username')}
        />

        <FormField
            label={mode === 'create' ? 'Password' : 'Password (leave empty to keep current)'}
            type='password'
            placeholder={mode === 'edit' ? 'Leave empty to keep current' : 'SSH password'}
            {...field('password')}
        />
    </>
);

export default SSHConnectionForm;
