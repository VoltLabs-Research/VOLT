import { useEffect } from 'react';
import Modal, { closeModal } from '@/shared/presentation/components/Modal';
import Button from '@/shared/presentation/components/Button';
import useForm from '@/shared/presentation/hooks/use-form';
import { showPromise } from '@/shared/presentation/hooks/toast';
import useSSHUseCases from '@/modules/ssh/presentation/hooks/use-ssh-use-cases';
import SSHConnectionForm from '@/modules/ssh/presentation/components/molecules/SSHConnectionForm';
import SSHConnectionTestButton from '@/modules/ssh/presentation/components/atoms/SSHConnectionTestButton';
import { SSHConnectionFormData, defaultValues, createSSHConnectionSchema } from './validation-schema';
import type { SSHConnection } from '@/modules/ssh/domain/entities';
import type { CreateSSHConnectionParams, UpdateSSHConnectionParams } from '@/modules/ssh/domain/ports/ISSHRepository';

export const SSH_CONNECTION_MODAL_ID = 'ssh-connection-modal';

interface SSHConnectionModalProps {
    connection: SSHConnection | null;
    mode: 'create' | 'edit';
    onSuccess?: () => void;
};

const SSHConnectionModal = ({ connection, mode, onSuccess }: SSHConnectionModalProps) => {
    const { sshRepository } = useSSHUseCases();
    const form = useForm<SSHConnectionFormData>({
        initialValues: defaultValues,
        schema: createSSHConnectionSchema(mode)
    });

    useEffect(() => {
        if (mode === 'edit' && connection) {
            form.reset({
                name: connection.name,
                host: connection.host,
                port: String(connection.port),
                username: connection.username,
                password: ''
            });
        } else {
            form.reset(defaultValues);
        }
    }, [mode, connection]);

    const handleSubmit = form.handleSubmit(async (values) => {
        const port = parseInt(values.port);

        const action = async () => {
            if (mode === 'create') {
                const params: CreateSSHConnectionParams = {
                    name: values.name,
                    host: values.host,
                    port,
                    username: values.username,
                    password: values.password
                };
                await sshRepository.createConnection(params);
            } else if (connection) {
                const params: UpdateSSHConnectionParams = {
                    name: values.name,
                    host: values.host,
                    port,
                    username: values.username
                };
                if (values.password.trim()) {
                    params.password = values.password;
                }
                await sshRepository.updateConnection(connection._id, params);
            }
        };

        await showPromise(action(), {
            loading: { title: mode === 'create' ? 'Creating connection...' : 'Updating connection...' },
            success: { title: mode === 'create' ? 'Connection created' : 'Connection updated' },
            error: { title: 'Failed to save connection' }
        });

        closeModal(SSH_CONNECTION_MODAL_ID);
        onSuccess?.();
    });

    return (
        <Modal
            id={SSH_CONNECTION_MODAL_ID}
            title={mode === 'create' ? 'Add SSH Connection' : 'Edit SSH Connection'}
            width='460px'
            footer={
                <>
                    <Button
                        variant='outline'
                        intent='neutral'
                        command='close'
                        commandfor={SSH_CONNECTION_MODAL_ID}
                    >
                        Cancel
                    </Button>
                    <Button
                        type='submit'
                        form='ssh-connection-form'
                        variant='solid'
                        intent='brand'
                        disabled={form.isSubmitting}
                        isLoading={form.isSubmitting}
                    >
                        {mode === 'create' ? 'Add Connection' : 'Save Changes'}
                    </Button>
                </>
            }
        >
            <form id='ssh-connection-form' onSubmit={handleSubmit} className='d-flex column gap-1 p-1-5'>
                <SSHConnectionForm field={form.field} mode={mode} />
                
                {mode === 'edit' && connection && (
                    <SSHConnectionTestButton connectionId={connection._id} />
                )}
            </form>
        </Modal>
    );
};

export default SSHConnectionModal;
