import FormFieldRHF from '@/shared/presentation/components/FormFieldRHF';
import type { Control } from 'react-hook-form';
import type { SSHConnectionFormData } from '@/modules/ssh/utilities/ssh-connection-form-schema';

interface SSHConnectionFormProps {
    control: Control<SSHConnectionFormData>;
    mode: 'create' | 'edit';
};

const SSHConnectionForm = ({ control, mode }: SSHConnectionFormProps) => (
    <>
        <FormFieldRHF
            name='name'
            control={control}
            label='Connection Name'
            placeholder='e.g., Production Server'
        />

        <FormFieldRHF
            name='host'
            control={control}
            label='Host'
            placeholder='hostname or IP address'
        />

        <FormFieldRHF
            name='port'
            control={control}
            label='Port'
            type='number'
            placeholder='22'
        />

        <FormFieldRHF
            name='username'
            control={control}
            label='Username'
            placeholder='SSH username'
        />

        <FormFieldRHF
            name='password'
            control={control}
            label={mode === 'create' ? 'Password' : 'Password (leave empty to keep current)'}
            type='password'
            placeholder={mode === 'edit' ? 'Leave empty to keep current' : 'SSH password'}
        />
    </>
);

export default SSHConnectionForm;
